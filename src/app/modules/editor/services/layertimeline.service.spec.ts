import {
  ClipPathLayer,
  GroupLayer,
  type Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { MathUtil } from 'app/modules/editor/scripts/common';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { ActionCreators } from 'redux-undo';

import { createEditorServices, type EditorServices } from './createEditorServices';

describe('LayerTimelineService', () => {
  let store: Store<State>;
  let services: EditorServices;

  beforeEach(() => {
    store = createEditorStore();
    services = createEditorServices(store);
  });

  afterEach(() => {
    services.dispose();
  });

  function load(children: Layer[], blocks: AnimationBlock[] = []) {
    const vectorLayer = new VectorLayer({ name: 'vector', children, width: 24, height: 24 });
    const animation = new Animation();
    animation.blocks = blocks;
    store.dispatch(new ResetWorkspace(vectorLayer, animation));
  }

  function newPath(name: string, pathData = 'M 1 1 L 5 1', strokeWidth = 0) {
    return new PathLayer({
      name,
      children: [],
      pathData: new Path(pathData),
      fillColor: strokeWidth ? '' : '#000000',
      strokeColor: strokeWidth ? '#000000' : '',
      strokeWidth,
    });
  }

  function newGroup(name: string, children: Layer[], transform: Partial<GroupLayer> = {}) {
    return new GroupLayer({ name, children, ...transform });
  }

  function getLayer<T extends Layer>(name: string) {
    const layer = services.layerTimelineService.getVectorLayer().findLayerByName(name);
    if (!layer) {
      throw new Error(`There's no layer named ${name}`);
    }
    return layer as T;
  }

  /** Returns the layer tree as nested names, e.g. { vector: ['path', { group: ['path2'] }] }. */
  function getTree(layer: Layer = services.layerTimelineService.getVectorLayer()): unknown {
    return layer instanceof VectorLayer || layer instanceof GroupLayer
      ? { [layer.name]: layer.children.map(l => getTree(l)) }
      : layer.name;
  }

  function getLayerIds() {
    const ids: string[] = [];
    services.layerTimelineService.getVectorLayer().walk(l => ids.push(l.id));
    return ids;
  }

  function getBlocks() {
    return services.layerTimelineService.getAnimation().blocks;
  }

  describe('importLayers', () => {
    function newFile(...children: Layer[]) {
      return new VectorLayer({ name: 'file', children, width: 12, height: 12 });
    }

    it('returns the ids of the layers each file added', () => {
      load([newPath('existing')]);
      const a = newPath('a');
      const b = newPath('b');
      const c = newGroup('c', [newPath('d')]);
      const ids = services.layerTimelineService.importLayers([newFile(a, b), newFile(c)]);

      expect(ids).toEqual([[a.id, b.id], [c.id]]);
      expect(getTree()).toEqual({ vector: ['existing', 'a', 'b', { c: ['d'] }] });
    });

    it('returns the ids when the first file replaces an empty document', () => {
      load([]);
      const a = newPath('a');
      const b = newPath('b');
      const ids = services.layerTimelineService.importLayers([newFile(a), newFile(b)]);

      expect(ids).toEqual([[a.id], [b.id]]);
      expect(getTree()).toEqual({ vector: ['a', 'b'] });
    });

    it('returns nothing without any files', () => {
      expect(services.layerTimelineService.importLayers([])).toEqual([]);
    });
  });

  describe('addLayer', () => {
    it('adds a layer next to the selected one, in the parent getParentIdForNewLayer returns', () => {
      load([newPath('a'), newGroup('g', [newPath('b')])]);
      const lts = services.layerTimelineService;
      expect(lts.getParentIdForNewLayer()).toBe(lts.getVectorLayer().id);

      lts.setSelectedLayers(new Set([getLayer('b').id]));
      expect(lts.getParentIdForNewLayer()).toBe(getLayer('g').id);
      lts.addLayer(newPath('c'));
      expect(getTree()).toEqual({ vector: ['a', { g: ['b', 'c'] }] });

      lts.setSelectedLayers(new Set([getLayer('g').id]));
      lts.addLayer(newPath('d'));
      expect(getTree()).toEqual({ vector: ['a', { g: ['b', 'c'] }, 'd'] });
    });
  });

  describe('addBlocks', () => {
    function addStrokeWidthBlock(layerId: string, autoSelectBlocks?: boolean) {
      services.layerTimelineService.addBlocks(
        [{ layerId, propertyName: 'strokeWidth', fromValue: 1, toValue: 2, currentTime: 0 }],
        autoSelectBlocks,
      );
    }

    it('selects the added blocks', () => {
      const path = newPath('path', undefined, 1);
      load([path]);
      services.layerTimelineService.setSelectedLayers(new Set([path.id]));
      addStrokeWidthBlock(path.id);

      expect(services.layerTimelineService.getSelectedBlocks()).toEqual(getBlocks());
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(new Set());
    });

    it('keeps the selection without autoSelectBlocks', () => {
      const path = newPath('path', undefined, 1);
      load([path]);
      services.layerTimelineService.setSelectedLayers(new Set([path.id]));
      addStrokeWidthBlock(path.id, false);

      expect(getBlocks()).toHaveLength(1);
      expect(services.layerTimelineService.getSelectedBlocks()).toEqual([]);
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(new Set([path.id]));
    });
  });

  describe('flattenGroupLayer', () => {
    it('keeps the stroke width of paths in groups that are only rotated', () => {
      load([
        newGroup('group', [newPath('path', 'M 4 12 L 20 12', 3)], {
          rotation: 90,
          pivotX: 12,
          pivotY: 12,
        }),
      ]);
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      expect(getTree()).toEqual({ vector: ['path'] });
      const path = getLayer<PathLayer>('path');
      expect(path.strokeWidth).toBe(3);
      const [start, end] = path.pathData!.getCommands().map(c => c.end);
      expect(start.x).toBeCloseTo(12);
      expect(start.y).toBeCloseTo(4);
      expect(end.x).toBeCloseTo(12);
      expect(end.y).toBeCloseTo(20);
    });

    it('scales the paths, their stroke widths, and their path animations', () => {
      const path = newPath('path', 'M 1 1 L 5 1', 3);
      const group = newGroup('group', [path, newPath('filled')], { scaleX: 2, scaleY: 2 });
      load(
        [group],
        [
          AnimationBlock.from({
            type: 'path',
            layerId: path.id,
            propertyName: 'pathData',
            fromValue: new Path('M 1 1 L 5 1'),
            toValue: new Path('M 1 2 L 5 2'),
          }),
          AnimationBlock.from({
            type: 'number',
            layerId: group.id,
            propertyName: 'rotation',
            fromValue: 0,
            toValue: 90,
          }),
        ],
      );
      services.layerTimelineService.flattenGroupLayer(group.id);

      expect(getTree()).toEqual({ vector: ['path', 'filled'] });
      expect(getLayer<PathLayer>('path').pathData!.getPathString()).toBe('M 2 2 L 10 2');
      expect(getLayer<PathLayer>('path').strokeWidth).toBe(6);
      expect(getLayer<PathLayer>('filled').strokeWidth).toBe(0);
      // The group's own animations are removed.
      const blocks = getBlocks();
      expect(blocks.length).toBe(1);
      const block = blocks[0] as PathAnimationBlock;
      expect(block.fromValue!.getPathString()).toBe('M 2 2 L 10 2');
      expect(block.toValue!.getPathString()).toBe('M 2 4 L 10 4');
    });

    it('moves the transform into child groups', () => {
      load([
        newGroup('group', [newGroup('child', [newPath('path')], { rotation: 45 })], {
          translateX: 5,
          translateY: 7,
        }),
      ]);
      const before = drawnAt('path', 5, 1);
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      expect(getTree()).toEqual({ vector: [{ child: ['path'] }] });
      const child = getLayer<GroupLayer>('child');
      expect(child.rotation).toBeCloseTo(45);
      // Its pivot stays where it was on the canvas.
      expect([child.pivotX, child.pivotY]).toEqual([5, 7]);
      expect(drawnAt('path', 5, 1)).toEqual(before);
    });

    // MODEL-1: the transform's rotation and scales used to be read off of the matrix in a way
    // that only worked for positive scales and turns of less than 90 degrees.
    it('moves mirrored and turned transforms into child groups', () => {
      for (const transform of [{ scaleX: -1 }, { rotation: 135 }, { scaleY: -2, rotation: 200 }]) {
        load([
          newGroup('group', [newGroup('child', [newPath('path', 'M 1 1 L 5 2')], transform)], {
            translateX: 3,
            rotation: 20,
          }),
        ]);
        const before = [drawnAt('path', 1, 1), drawnAt('path', 5, 2)];
        services.layerTimelineService.flattenGroupLayer(getLayer('group').id);
        expect(getTree()).toEqual({ vector: [{ child: ['path'] }] });
        expect([drawnAt('path', 1, 1), drawnAt('path', 5, 2)]).toEqual(before);
      }
    });

    // STORE-14: only the static width used to be scaled.
    it("scales the paths' stroke width blocks too", () => {
      const path = newPath('path', 'M 1 1 L 5 1', 1);
      const group = newGroup('group', [path], { scaleX: 3, scaleY: 3 });
      load(
        [group],
        [
          AnimationBlock.from({
            type: 'number',
            layerId: path.id,
            propertyName: 'strokeWidth',
            fromValue: 1,
            toValue: 2,
          }),
        ],
      );
      services.layerTimelineService.flattenGroupLayer(group.id);
      expect(getLayer<PathLayer>('path').strokeWidth).toBe(3);
      const [block] = getBlocks();
      expect([block.fromValue, block.toValue]).toEqual([3, 6]);
    });

    /** Where the layer's point is drawn. */
    function drawnAt(name: string, x: number, y: number) {
      const vl = services.layerTimelineService.getVectorLayer();
      const layer = getLayer(name);
      const point = MathUtil.transformPoint(
        { x, y },
        LayerUtil.getCanvasTransformForLayer(vl, layer.id),
      );
      return [point.x, point.y].map(n => Math.round(n * 1e6) / 1e6);
    }

    it('moves the transform into paths that use their own, and keeps their paths', () => {
      const path = newPath('path', 'M 1 1 L 5 1', 2);
      path.rotation = 90;
      path.pivotX = 3;
      path.pivotY = 1;
      load([newGroup('group', [path], { rotation: 180, translateX: 10 })]);
      const before = drawnAt('path', 5, 1);
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      expect(getTree()).toEqual({ vector: ['path'] });
      const flattened = getLayer<PathLayer>('path');
      expect(flattened.pathData!.getPathString()).toBe('M 1 1 L 5 1');
      // The stroke is scaled by the path's transform, as it was.
      expect(flattened.strokeWidth).toBe(2);
      expect(flattened.rotation).toBeCloseTo(-90);
      expect(drawnAt('path', 5, 1)).toEqual(before);
      // Its pivot moves with the group's transform, so a later rotation turns around the same
      // point on the canvas.
      expect([flattened.pivotX, flattened.pivotY]).toEqual([7, -1]);
    });

    it("bakes a path's transform into its path when the group's would skew it", () => {
      const path = newPath('path', 'M 1 1 L 5 1 L 5 3', 1);
      path.rotation = 30;
      load([newGroup('group', [path], { scaleX: 2 })]);
      const before = [drawnAt('path', 1, 1), drawnAt('path', 5, 1), drawnAt('path', 5, 3)];
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      const flattened = getLayer<PathLayer>('path');
      expect([flattened.rotation, flattened.scaleX, flattened.translateX]).toEqual([0, 1, 0]);
      const points = flattened.pathData!.getCommands().map(c => c.end);
      expect(points.map(p => [p.x, p.y].map(n => Math.round(n * 1e3) / 1e3))).toEqual(
        before.map(p => p.map(n => Math.round(n * 1e3) / 1e3)),
      );
    });

    it('moves the pivots of other paths with them', () => {
      const path = newPath('path');
      path.pivotX = 12;
      path.pivotY = 12;
      load([newGroup('group', [path], { translateX: 3 })]);
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      const flattened = getLayer<PathLayer>('path');
      expect(flattened.pathData!.getPathString()).toBe('M 4 1 L 8 1');
      expect([flattened.pivotX, flattened.pivotY, flattened.translateX]).toEqual([15, 12, 0]);
    });
  });

  describe('groupOrUngroupSelectedLayers', () => {
    function select(...names: string[]) {
      services.layerTimelineService.setSelectedLayers(new Set(names.map(n => getLayer(n).id)));
    }

    function getSelectedNames() {
      return services.layerTimelineService.getSelectedLayers().map(l => l.name);
    }

    it('groups layers in the same parent where the first one was', () => {
      load([newPath('a'), newPath('b'), newPath('c')]);
      select('a', 'c');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);

      expect(getTree()).toEqual({ vector: [{ group: ['a', 'c'] }, 'b'] });
      expect(getSelectedNames()).toEqual(['group']);
    });

    it("pivots new groups at the canvas's center, in their parent's coordinates", () => {
      load([newPath('a'), newGroup('g', [newPath('b')], { translateX: 2, translateY: -3 })]);
      select('a');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);
      const group = getLayer<GroupLayer>('group');
      expect([group.pivotX, group.pivotY]).toEqual([12, 12]);

      select('b');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);
      const nested = getLayer<GroupLayer>('group_1');
      expect(getTree()).toEqual({ vector: [{ group: ['a'] }, { g: [{ group_1: ['b'] }] }] });
      expect([nested.pivotX, nested.pivotY]).toEqual([10, 15]);
    });

    it('moves layers out of their other parents when grouping them', () => {
      load([newPath('a'), newGroup('g', [newPath('b'), newPath('c')])]);
      select('a', 'b');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);

      expect(getTree()).toEqual({ vector: [{ group: ['a', 'b'] }, { g: ['c'] }] });
      const ids = getLayerIds();
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('puts the group where the first layer in tree order was', () => {
      load([newGroup('g', [newPath('b')]), newPath('a')]);
      select('a', 'b');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);

      expect(getTree()).toEqual({ vector: [{ g: [{ group: ['b', 'a'] }] }] });
    });

    it("doesn't move layers whose parent is also selected", () => {
      load([newGroup('g', [newPath('b')]), newPath('a')]);
      select('g', 'b');
      services.layerTimelineService.groupOrUngroupSelectedLayers(true);

      expect(getTree()).toEqual({ vector: [{ group: [{ g: ['b'] }] }, 'a'] });
    });

    it('moves the children of ungrouped groups into their parents', () => {
      load([newPath('a'), newGroup('g', [newPath('b'), newPath('c')]), newPath('d')]);
      select('g');
      services.layerTimelineService.groupOrUngroupSelectedLayers(false);

      expect(getTree()).toEqual({ vector: ['a', 'b', 'c', 'd'] });
      expect(getSelectedNames()).toEqual(['b', 'c']);
    });
  });

  describe('selectAllLayers', () => {
    it('selects the visible layers at the top of the tree, with groups as a whole', () => {
      const clipPath = new ClipPathLayer(newPath('clip'));
      load([clipPath, newPath('a'), newGroup('g', [newPath('b')]), newPath('hidden')]);
      services.layerTimelineService.toggleVisibleLayer(getLayer('hidden').id);
      services.layerTimelineService.selectAllLayers();
      expect(services.layerTimelineService.getSelectedLayers().map(l => l.name)).toEqual([
        'clip',
        'a',
        'g',
      ]);
    });
  });

  describe('convertLayer', () => {
    it('converts paths to clip paths and back, keeping the id and the animations that apply', () => {
      const path = newPath('path');
      load(
        [newPath('before'), path, newPath('after')],
        [
          AnimationBlock.from({
            type: 'path',
            layerId: path.id,
            propertyName: 'pathData',
            fromValue: new Path('M 1 1 L 5 1'),
            toValue: new Path('M 1 2 L 5 2'),
          }),
          AnimationBlock.from({
            type: 'color',
            layerId: path.id,
            propertyName: 'fillColor',
            fromValue: '#000000',
            toValue: '#ff0000',
          }),
        ],
      );
      services.layerTimelineService.setSelectedLayers(new Set([path.id]));
      services.layerTimelineService.toggleVisibleLayer(path.id);

      services.layerTimelineService.convertLayer(path.id);
      expect(getTree()).toEqual({ vector: ['before', 'path', 'after'] });
      expect(getLayer('path')).toBeInstanceOf(ClipPathLayer);
      expect(getLayer('path').id).toBe(path.id);
      // Clip paths can't be filled.
      expect(getBlocks().map(b => [b.layerId, b.propertyName])).toEqual([[path.id, 'pathData']]);
      // It's still selected and hidden, since it's the same layer.
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(new Set([path.id]));
      expect(store.getState().present.layers.hiddenLayerIds).toEqual(new Set([path.id]));

      services.layerTimelineService.convertLayer(path.id);
      expect(getLayer('path')).toBeInstanceOf(PathLayer);
      expect(getLayer<PathLayer>('path').pathData?.getPathString()).toBe('M 1 1 L 5 1');
      expect(getBlocks().map(b => [b.layerId, b.propertyName])).toEqual([[path.id, 'pathData']]);
    });

    it("bakes a path's transform into the clip path's path and path blocks", () => {
      const path = newPath('path', 'M 1 1 L 5 1');
      path.translateX = 2;
      path.scaleY = 3;
      load(
        [path],
        [
          AnimationBlock.from({
            type: 'path',
            layerId: path.id,
            propertyName: 'pathData',
            fromValue: new Path('M 1 1 L 5 1'),
            toValue: new Path('M 1 2 L 5 2'),
          }),
        ],
      );
      services.layerTimelineService.convertLayer(path.id);

      expect(getLayer<ClipPathLayer>('path').pathData?.getPathString()).toBe('M 3 3 L 7 3');
      const [block] = getBlocks() as PathAnimationBlock[];
      expect(block.toValue?.getPathString()).toBe('M 3 6 L 7 6');
    });
  });

  describe('combineSelectedLayers and breakApartSelectedLayers', () => {
    it('combines the selected paths into the bottom one, and breaks it apart again', () => {
      const a = newPath('a', 'M 1 1 L 5 1 L 5 5 Z');
      const b = newPath('b', 'M 10 10 L 15 10 L 15 15 Z');
      load([a, newGroup('g', [b], { translateX: 2 })]);
      services.layerTimelineService.setSelectedLayers(new Set([a.id, b.id]));
      services.layerTimelineService.toggleVisibleLayer(b.id);

      expect(services.layerTimelineService.combineSelectedLayers()).toBeUndefined();
      expect(getTree()).toEqual({ vector: ['a', { g: [] }] });
      expect(getLayer<PathLayer>('a').pathData?.getPathString()).toBe(
        'M 1 1 L 5 1 L 5 5 Z M 12 10 L 17 10 L 17 15 Z',
      );
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(new Set([a.id]));
      // The removed path's state goes with it.
      expect(store.getState().present.layers.hiddenLayerIds).toEqual(new Set());

      expect(services.layerTimelineService.breakApartSelectedLayers()).toBeUndefined();
      expect(getTree()).toEqual({ vector: ['a', 'a_1', { g: [] }] });
      expect(getLayer<PathLayer>('a_1').pathData?.getPathString()).toBe(
        'M 12 10 L 17 10 L 17 15 Z',
      );
      expect(services.layerTimelineService.getSelectedLayerIds()).toEqual(
        new Set([a.id, getLayer('a_1').id]),
      );
    });

    it("says why it can't", () => {
      const a = newPath('a');
      load([a, newGroup('g', [])]);
      services.layerTimelineService.setSelectedLayers(new Set([a.id, getLayer('g').id]));
      expect(services.layerTimelineService.combineSelectedLayers()).toBe(
        'Only paths can be combined',
      );
      expect(services.layerTimelineService.breakApartSelectedLayers()).toBe(
        'Select a path with more than one subpath',
      );
      expect(getTree()).toEqual({ vector: ['a', { g: [] }] });
    });

    it('combines into a transformed path in its coordinates, and breaks apart keeping it', () => {
      const a = newPath('a', 'M 0 0 L 2 0 L 2 2 Z');
      a.rotation = 90;
      a.translateX = 10;
      const b = newPath('b', 'M 10 0 L 10 2 L 8 2 Z');
      load([a, b]);
      services.layerTimelineService.setSelectedLayers(new Set([a.id, b.id]));

      expect(services.layerTimelineService.combineSelectedLayers()).toBeUndefined();
      const combined = getLayer<PathLayer>('a');
      expect([combined.rotation, combined.translateX]).toEqual([90, 10]);
      // b is drawn where it was, through a's rotation.
      expect(combined.pathData?.getPathString()).toBe('M 0 0 L 2 0 L 2 2 Z M 0 0 L 2 0 L 2 2 Z');

      expect(services.layerTimelineService.breakApartSelectedLayers()).toBeUndefined();
      expect(getTree()).toEqual({ vector: ['a', 'a_1'] });
      const piece = getLayer<PathLayer>('a_1');
      expect([piece.rotation, piece.translateX]).toEqual([90, 10]);
    });

    it('refuses to combine paths whose transforms are animated', () => {
      const a = newPath('a');
      const b = newPath('b', 'M 1 3 L 5 3');
      load(
        [a, b],
        [
          AnimationBlock.from({
            type: 'number',
            layerId: a.id,
            propertyName: 'rotation',
            fromValue: 0,
            toValue: 90,
          }),
        ],
      );
      services.layerTimelineService.setSelectedLayers(new Set([a.id, b.id]));
      expect(services.layerTimelineService.combineSelectedLayers()).toBe(
        "a's transform is animated",
      );
    });
  });

  describe('addBlockForProperty', () => {
    it("adds a block from the layer's value to itself at the current time, and selects it", () => {
      const path = newPath('path', undefined, 3);
      load([path]);
      services.playbackService.setCurrentTime(150);
      services.layerTimelineService.addBlockForProperty(path.id, 'strokeWidth');
      const [block] = getBlocks();
      expect(block).toMatchObject({
        layerId: path.id,
        propertyName: 'strokeWidth',
        fromValue: 3,
        toValue: 3,
        startTime: 150,
      });
      expect(services.layerTimelineService.getSelectedBlocks()).toEqual([block]);
      // Properties the layer doesn't have are ignored.
      services.layerTimelineService.addBlockForProperty(path.id, 'canvasColor');
      expect(getBlocks()).toHaveLength(1);
    });
  });

  describe('updateLayers', () => {
    it('updates several layers as one dispatch, e.g. a batch edit', () => {
      load([newPath('path'), newPath('other')]);
      const path = getLayer<PathLayer>('path').clone();
      path.fillColor = '#ff0000';
      const other = getLayer<PathLayer>('other').clone();
      other.fillColor = '#ff0000';
      const numPastStates = store.getState().past.length;

      services.layerTimelineService.updateLayers([path, other]);

      expect(getLayer<PathLayer>('path').fillColor).toBe('#ff0000');
      expect(getLayer<PathLayer>('other').fillColor).toBe('#ff0000');
      // One dispatch is one undo step.
      expect(store.getState().past.length).toBe(numPastStates + 1);
      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000000');
      expect(getLayer<PathLayer>('other').fillColor).toBe('#000000');
    });

    it('does nothing without any layers', () => {
      load([newPath('path')]);
      const numPastStates = store.getState().past.length;
      services.layerTimelineService.updateLayers([]);
      expect(store.getState().past.length).toBe(numPastStates);
    });
  });

  describe('previews', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function previewFillColor(color: string) {
      const path = getLayer<PathLayer>('path').clone();
      path.fillColor = color;
      services.layerTimelineService.previewLayer(path);
    }

    function newColorBlock(layerId: string) {
      return AnimationBlock.from({
        type: 'color',
        layerId,
        propertyName: 'fillColor',
        fromValue: '#000000',
        toValue: '#ff0000',
      });
    }

    it('saves previews that took more than a second as one undo step', () => {
      load([newPath('path')]);
      vi.advanceTimersByTime(2000);
      const numPastStates = store.getState().past.length;
      for (let i = 0; i < 30; i++) {
        vi.advanceTimersByTime(100);
        previewFillColor(`#0000${(i + 10).toString(16).padStart(2, '0')}`);
      }
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000027');
      expect(store.getState().past.length).toBe(numPastStates);

      services.layerTimelineService.commitPreview();
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000027');
      expect(store.getState().past.length).toBe(numPastStates + 1);

      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000000');
      store.dispatch(ActionCreators.redo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000027');
    });

    it("doesn't merge a quick preview into the edit right before it", () => {
      load([newPath('path'), newPath('other')]);
      vi.advanceTimersByTime(2000);
      services.layerTimelineService.setSelectedLayers(new Set([getLayer('other').id]));
      vi.advanceTimersByTime(100);
      previewFillColor('#ff0000');
      services.layerTimelineService.commitPreview();

      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000000');
      expect(services.layerTimelineService.getSelectedLayers().map(l => l.name)).toEqual(['other']);
    });

    it('previews several layers at once, e.g. a batch color drag, and commits them as one step', () => {
      load([newPath('path'), newPath('other')]);
      vi.advanceTimersByTime(2000);
      const numPastStates = store.getState().past.length;
      const path = getLayer<PathLayer>('path').clone();
      path.fillColor = '#ff0000';
      const other = getLayer<PathLayer>('other').clone();
      other.fillColor = '#ff0000';

      services.layerTimelineService.previewLayers([path, other]);
      expect(getLayer<PathLayer>('path').fillColor).toBe('#ff0000');
      expect(getLayer<PathLayer>('other').fillColor).toBe('#ff0000');
      expect(store.getState().past.length).toBe(numPastStates);

      services.layerTimelineService.commitPreview();
      expect(store.getState().past.length).toBe(numPastStates + 1);
      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000000');
      expect(getLayer<PathLayer>('other').fillColor).toBe('#000000');
    });

    it('previews blocks', () => {
      const path = newPath('path');
      load([path], [newColorBlock(path.id)]);
      vi.advanceTimersByTime(2000);
      const block = getBlocks()[0].clone();
      block.toValue = '#00ff00';
      services.layerTimelineService.previewBlocks([block]);
      vi.advanceTimersByTime(1500);
      services.layerTimelineService.commitPreview();
      expect(getBlocks()[0].toValue).toBe('#00ff00');

      store.dispatch(ActionCreators.undo());
      expect(getBlocks()[0].toValue).toBe('#ff0000');
    });

    it('goes back to the values from before the previews when canceled', () => {
      load([newPath('path')]);
      const vl = services.layerTimelineService.getVectorLayer();
      vi.advanceTimersByTime(2000);
      const numPastStates = store.getState().past.length;
      previewFillColor('#ff0000');
      previewFillColor('#00ff00');
      services.layerTimelineService.cancelPreview();
      expect(services.layerTimelineService.getVectorLayer()).toBe(vl);
      expect(store.getState().past.length).toBe(numPastStates);
    });

    it('saves a preview in the undo step of a recorded action during it', () => {
      load([newPath('path'), newPath('other')]);
      vi.advanceTimersByTime(2000);
      const path = getLayer<PathLayer>('path').clone();
      path.strokeColor = '#0000ff';
      services.layerTimelineService.updateLayer(path);
      vi.advanceTimersByTime(200);
      previewFillColor('#ff0000');
      vi.advanceTimersByTime(300);
      // E.g. a keyboard shortcut in the middle of a drag.
      services.layerTimelineService.setSelectedLayers(new Set([getLayer('other').id]));
      const numPastStates = store.getState().past.length;

      // The selection's undo step already saved the preview, so these do nothing.
      services.layerTimelineService.cancelPreview();
      expect(getLayer<PathLayer>('path').fillColor).toBe('#ff0000');
      services.layerTimelineService.commitPreview();
      expect(store.getState().past.length).toBe(numPastStates);

      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#000000');
      expect(getLayer<PathLayer>('path').strokeColor).toBe('#0000ff');
      expect(services.layerTimelineService.getSelectedLayers()).toEqual([]);
    });

    it('clears the redo history when a preview after an undo is saved', () => {
      load([newPath('path')]);
      vi.advanceTimersByTime(2000);
      const path = getLayer<PathLayer>('path').clone();
      path.strokeColor = '#0000ff';
      services.layerTimelineService.updateLayer(path);
      vi.advanceTimersByTime(2000);
      store.dispatch(ActionCreators.undo());
      expect(store.getState().future.length).toBe(1);

      previewFillColor('#ff0000');
      services.layerTimelineService.commitPreview();
      expect(store.getState().future.length).toBe(0);
      // There's nothing to redo, so the undone stroke color stays undone.
      store.dispatch(ActionCreators.redo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#ff0000');
      expect(getLayer<PathLayer>('path').strokeColor).toBe('');
    });

    it('gives an edit right after a saved preview an undo step of its own', () => {
      load([newPath('path'), newPath('other')]);
      vi.advanceTimersByTime(2000);
      previewFillColor('#ff0000');
      services.layerTimelineService.commitPreview();
      vi.advanceTimersByTime(100);
      services.layerTimelineService.setSelectedLayers(new Set([getLayer('other').id]));

      store.dispatch(ActionCreators.undo());
      expect(getLayer<PathLayer>('path').fillColor).toBe('#ff0000');
      expect(services.layerTimelineService.getSelectedLayers()).toEqual([]);
    });

    it("doesn't save an undo step for a preview that ends where it started", () => {
      load([newPath('path')]);
      const vl = services.layerTimelineService.getVectorLayer();
      vi.advanceTimersByTime(2000);
      const numPastStates = store.getState().past.length;
      previewFillColor('#ff0000');
      previewFillColor('#000000');
      services.layerTimelineService.commitPreview();
      expect(store.getState().past.length).toBe(numPastStates);
      expect(services.layerTimelineService.getVectorLayer()).toBe(vl);
    });

    it("doesn't save an undo step without a preview", () => {
      load([newPath('path')]);
      vi.advanceTimersByTime(2000);
      const numPastStates = store.getState().past.length;
      services.layerTimelineService.commitPreview();
      expect(store.getState().past.length).toBe(numPastStates);
    });
  });
});
