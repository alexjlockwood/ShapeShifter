import {
  ClipPathLayer,
  GroupLayer,
  type Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { createEditorStore, type State, type Store } from 'app/modules/editor/store';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';

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
      services.layerTimelineService.flattenGroupLayer(getLayer('group').id);

      expect(getTree()).toEqual({ vector: [{ child: ['path'] }] });
      const child = getLayer<GroupLayer>('child');
      expect(child.translateX).toBe(5);
      expect(child.translateY).toBe(7);
      expect(child.rotation).toBeCloseTo(45);
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

  describe('swapLayers', () => {
    it('converts paths to clip paths and back, keeping the animations that still apply', () => {
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

      // This is how the layer list's "Convert to clip path" menu item builds the new layer.
      const clipPath = new ClipPathLayer(path);
      clipPath.id = 'clip';
      services.layerTimelineService.swapLayers(path.id, clipPath);
      expect(getTree()).toEqual({ vector: ['before', 'path', 'after'] });
      expect(getLayer('path')).toBeInstanceOf(ClipPathLayer);
      expect(getLayer('path').id).toBe('clip');
      // Clip paths can't be filled.
      expect(getBlocks().map(b => [b.layerId, b.propertyName])).toEqual([['clip', 'pathData']]);

      const convertedPath = new PathLayer(getLayer<ClipPathLayer>('path'));
      convertedPath.id = 'path';
      services.layerTimelineService.swapLayers('clip', convertedPath);
      expect(getLayer('path')).toBeInstanceOf(PathLayer);
      expect(getBlocks().map(b => [b.layerId, b.propertyName])).toEqual([['path', 'pathData']]);
    });
  });
});
