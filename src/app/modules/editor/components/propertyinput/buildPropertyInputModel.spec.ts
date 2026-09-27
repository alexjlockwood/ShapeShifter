import {
  GroupLayer,
  PathLayer,
  TRANSFORM_PROPERTY_NAMES,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import {
  createEditorServices,
  type EditorServices,
} from 'app/modules/editor/services/createEditorServices';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { getPropertyInputState } from 'app/modules/editor/store/common/selectors';
import { SetSelectedLayers } from 'app/modules/editor/store/layers/actions';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { SetSelectedBlocks } from 'app/modules/editor/store/timeline/actions';
import { ActionCreators } from 'redux-undo';

import {
  buildPropertyInputModel,
  getColorAlphaMultiplier,
  type PropertyInputModel,
} from './buildPropertyInputModel';

describe('buildPropertyInputModel', () => {
  let store: Store<State>;
  let services: EditorServices;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
  });

  afterEach(() => {
    services.dispose();
  });

  function getDeps() {
    const { layerTimelineService } = services;
    return { store, layerTimelineService, enteredValueMap: new Map() };
  }

  it("shows nothing if the selected layer or block doesn't exist", () => {
    const deps = getDeps();
    const noSelections: PropertyInputModel = {
      numSelections: 0,
      inspectedProperties: [],
      availablePropertyNames: [],
    };

    store.dispatch(new SetSelectedLayers(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
    store.dispatch(new SetSelectedLayers(new Set()));
    store.dispatch(new SetSelectedBlocks(new Set(['missing'])));
    expect(buildPropertyInputModel(deps, getPropertyInputState(store.getState()))).toEqual(
      noSelections,
    );
  });

  describe('previews', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function loadSelectedPath() {
      const path = new PathLayer({
        name: 'path',
        children: [],
        pathData: new Path('M 1 1 L 5 5'),
        fillColor: '#000000',
      });
      store.dispatch(new ResetWorkspace(new VectorLayer({ name: 'vector', children: [path] })));
      store.dispatch(new SetSelectedLayers(new Set([path.id])));
      vi.advanceTimersByTime(2000);
    }

    function getProperty(propertyName: string) {
      const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
      const ip = pim.inspectedProperties.find(p => p.propertyName === propertyName);
      if (!ip) {
        throw new Error(`${propertyName} is missing`);
      }
      return ip;
    }

    it("previews a layer's color and saves it as one undo step", () => {
      loadSelectedPath();
      expect(getProperty('fillColor').canPreview).toBe(true);
      getProperty('fillColor').previewValue('#ff0000');
      vi.advanceTimersByTime(1500);
      getProperty('fillColor').previewValue('#00ff00');
      expect(getProperty('fillColor').value).toBe('#00ff00');
      getProperty('fillColor').commitPreview();

      store.dispatch(ActionCreators.undo());
      expect(getProperty('fillColor').value).toBe('#000000');
    });

    it("goes back to a layer's color from before the previews when canceled", () => {
      loadSelectedPath();
      const numPastStates = store.getState().past.length;
      getProperty('fillColor').previewValue('#ff0000');
      getProperty('fillColor').cancelPreview();
      expect(getProperty('fillColor').value).toBe('#000000');
      expect(store.getState().past.length).toBe(numPastStates);
    });

    it("previews a block's interpolator and saves it as one undo step", () => {
      loadSelectedPath();
      const [path] = services.layerTimelineService.getVectorLayer().children;
      services.layerTimelineService.addBlocks([
        { layerId: path.id, propertyName: 'fillAlpha', fromValue: 1, toValue: 0, currentTime: 0 },
      ]);
      const [block] = services.layerTimelineService.getAnimation().blocks;
      store.dispatch(new SetSelectedBlocks(new Set([block.id])));
      vi.advanceTimersByTime(2000);
      const before = getProperty('interpolator').value;

      expect(getProperty('interpolator').canPreview).toBe(true);
      getProperty('interpolator').previewValue('M 0 0 C 0.3 0 0.2 1 1 1');
      vi.advanceTimersByTime(1500);
      getProperty('interpolator').previewValue('M 0 0 C 0.4 0.2 0.2 1 1 1');
      expect(getProperty('interpolator').getDisplayValue()).toBe('Custom');
      getProperty('interpolator').commitPreview();
      expect(getProperty('interpolator').value).toBe('M 0 0 C 0.4 0.2 0.2 1 1 1');

      store.dispatch(ActionCreators.undo());
      expect(getProperty('interpolator').value).toBe(before);
    });

    it("doesn't preview a layer's name", () => {
      loadSelectedPath();
      // A preview would skip the name's sanitizing and uniqueness checks.
      expect(getProperty('name').canPreview).toBe(false);
      expect(getProperty('pathData').canPreview).toBe(false);
    });
  });

  describe('batch editing several layers', () => {
    function newPath(name: string, fillColor: string, strokeWidth = 2) {
      return new PathLayer({
        name,
        children: [],
        pathData: new Path('M 1 1 L 5 5'),
        fillColor,
        strokeWidth,
      });
    }

    it('shows the properties every selected layer shares, Mixed where they differ', () => {
      const path1 = newPath('path1', '#ff0000');
      const path2 = newPath('path2', '#00ff00');
      store.dispatch(
        new ResetWorkspace(new VectorLayer({ name: 'vector', children: [path1, path2] })),
      );
      store.dispatch(new SetSelectedLayers(new Set([path1.id, path2.id])));

      const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
      expect(pim.numSelections).toBe(2);
      expect(pim.description).toBe('2 layers');
      const byName = new Map(pim.inspectedProperties.map(ip => [ip.propertyName, ip]));
      // A batch edit never shows the name (it must stay unique) or the path (edited on the canvas).
      expect(byName.has('name')).toBe(false);
      expect(byName.has('pathData')).toBe(false);
      expect(byName.get('fillColor')?.value).toBeUndefined();
      expect(byName.get('strokeWidth')?.value).toBe(2);
      // There's no single model for a batch edit, so the color swatch multiplier just falls back.
      expect(getColorAlphaMultiplier(pim.model, 'fillColor')).toBe(1);
    });

    it('shares only the transform properties between a path and a group', () => {
      const group = new GroupLayer({ name: 'group', children: [], rotation: 45 });
      const path = newPath('path', '#ff0000');
      store.dispatch(
        new ResetWorkspace(new VectorLayer({ name: 'vector', children: [group, path] })),
      );
      store.dispatch(new SetSelectedLayers(new Set([group.id, path.id])));

      const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
      const names = pim.inspectedProperties.map(ip => ip.propertyName).sort();
      expect(names).toEqual([...TRANSFORM_PROPERTY_NAMES].sort());
    });

    it('applies a batch edit to every selected layer as one undo step', () => {
      vi.useFakeTimers();
      try {
        const path1 = newPath('path1', '#ff0000');
        const path2 = newPath('path2', '#00ff00');
        store.dispatch(
          new ResetWorkspace(new VectorLayer({ name: 'vector', children: [path1, path2] })),
        );
        store.dispatch(new SetSelectedLayers(new Set([path1.id, path2.id])));
        // Past the 1 second undo grouping window, so the edit below gets its own step.
        vi.advanceTimersByTime(2000);
        const numPastStates = store.getState().past.length;

        const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
        const strokeWidth = pim.inspectedProperties.find(ip => ip.propertyName === 'strokeWidth')!;
        strokeWidth.value = 5;

        expect(store.getState().past.length).toBe(numPastStates + 1);
        const vl = services.layerTimelineService.getVectorLayer();
        expect((vl.findLayerById(path1.id) as PathLayer).strokeWidth).toBe(5);
        expect((vl.findLayerById(path2.id) as PathLayer).strokeWidth).toBe(5);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('batch editing several blocks', () => {
    function newColorBlock(layerId: string, fromValue: string, toValue: string) {
      return AnimationBlock.from({
        type: 'color',
        layerId,
        propertyName: 'fillColor',
        fromValue,
        toValue,
      });
    }

    function newNumberBlock(layerId: string) {
      return AnimationBlock.from({
        type: 'number',
        layerId,
        propertyName: 'fillAlpha',
        fromValue: 1,
        toValue: 0,
      });
    }

    it('shows the properties every selected block shares, Mixed where they differ', () => {
      const path1 = new PathLayer({
        name: 'path1',
        children: [],
        pathData: new Path('M 1 1 L 5 5'),
      });
      const path2 = new PathLayer({
        name: 'path2',
        children: [],
        pathData: new Path('M 2 2 L 6 6'),
      });
      const block1 = newColorBlock(path1.id, '#000000', '#ffffff');
      const block2 = newColorBlock(path2.id, '#000000', '#111111');
      const animation = new Animation();
      animation.blocks = [block1, block2];
      store.dispatch(
        new ResetWorkspace(
          new VectorLayer({ name: 'vector', children: [path1, path2] }),
          animation,
        ),
      );
      store.dispatch(new SetSelectedBlocks(new Set([block1.id, block2.id])));

      const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
      expect(pim.numSelections).toBe(2);
      expect(pim.description).toBe('2 property animations');
      const byName = new Map(pim.inspectedProperties.map(ip => [ip.propertyName, ip]));
      expect(byName.get('fromValue')?.value).toBe('#000000');
      expect(byName.get('toValue')?.value).toBeUndefined();
      expect(byName.has('interpolator')).toBe(true);
    });

    it('only shares startTime, endTime, and interpolator between blocks of different types', () => {
      const path = new PathLayer({ name: 'path', children: [], pathData: new Path('M 1 1 L 5 5') });
      const block1 = newColorBlock(path.id, '#000000', '#ffffff');
      const block2 = newNumberBlock(path.id);
      const animation = new Animation();
      animation.blocks = [block1, block2];
      store.dispatch(
        new ResetWorkspace(new VectorLayer({ name: 'vector', children: [path] }), animation),
      );
      store.dispatch(new SetSelectedBlocks(new Set([block1.id, block2.id])));

      const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
      const names = pim.inspectedProperties.map(ip => ip.propertyName).sort();
      expect(names).toEqual(['endTime', 'interpolator', 'startTime']);
    });

    it('applies a batch edit to every selected block as one undo step', () => {
      vi.useFakeTimers();
      try {
        const path1 = new PathLayer({
          name: 'path1',
          children: [],
          pathData: new Path('M 1 1 L 5 5'),
        });
        const path2 = new PathLayer({
          name: 'path2',
          children: [],
          pathData: new Path('M 2 2 L 6 6'),
        });
        const block1 = newColorBlock(path1.id, '#000000', '#ffffff');
        const block2 = newColorBlock(path2.id, '#000000', '#111111');
        const animation = new Animation();
        animation.blocks = [block1, block2];
        store.dispatch(
          new ResetWorkspace(
            new VectorLayer({ name: 'vector', children: [path1, path2] }),
            animation,
          ),
        );
        store.dispatch(new SetSelectedBlocks(new Set([block1.id, block2.id])));
        // Past the 1 second undo grouping window, so the edit below gets its own step.
        vi.advanceTimersByTime(2000);
        const numPastStates = store.getState().past.length;

        const pim = buildPropertyInputModel(getDeps(), getPropertyInputState(store.getState()));
        const startTime = pim.inspectedProperties.find(ip => ip.propertyName === 'startTime')!;
        startTime.value = 50;

        expect(store.getState().past.length).toBe(numPastStates + 1);
        const blocks = services.layerTimelineService.getAnimation().blocks;
        expect(blocks.every(b => b.startTime === 50)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('#getColorAlphaMultiplier', () => {
  it("combines with fillColor's own alpha using the layer's fillAlpha", () => {
    expect(getColorAlphaMultiplier({ fillAlpha: 0.5, strokeAlpha: 0.25 }, 'fillColor')).toBe(0.5);
  });

  it("combines with strokeColor's own alpha using the layer's strokeAlpha", () => {
    expect(getColorAlphaMultiplier({ fillAlpha: 0.5, strokeAlpha: 0.25 }, 'strokeColor')).toBe(
      0.25,
    );
  });

  it('is 1 for a color with no separate alpha, like canvasColor or a block value', () => {
    expect(getColorAlphaMultiplier({}, 'canvasColor')).toBe(1);
    expect(getColorAlphaMultiplier({ fillAlpha: 0.5 }, 'fromValue')).toBe(1);
  });
});
