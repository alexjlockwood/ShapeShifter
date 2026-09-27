import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
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

import { buildPropertyInputModel, type PropertyInputModel } from './buildPropertyInputModel';

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
});
