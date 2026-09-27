import { GroupLayer, Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { duplicateLayers, getTopmostLayerIds, translateLayers } from './transformLayers';

function path(name: string, pathData: string) {
  return new PathLayer({ name, children: [], pathData: new Path(pathData), fillColor: '#000' });
}

function withBlocks(...blocks: AnimationBlock[]) {
  const animation = new Animation();
  animation.blocks = blocks;
  return animation;
}

function pathDataOf(vl: VectorLayer, layerId: string) {
  return (vl.findLayerById(layerId) as PathLayer).pathData?.getPathString();
}

describe('getTopmostLayerIds', () => {
  it('leaves out the layers inside of other ones, and the vector layer, in drawing order', () => {
    const a = path('a', 'M 0 0 L 1 1');
    const b = path('b', 'M 0 0 L 1 1');
    const group = new GroupLayer({ name: 'group', children: [a] });
    const vl = new VectorLayer({ name: 'vector', children: [group, b] });
    expect(getTopmostLayerIds(vl, [b.id, a.id, group.id, vl.id])).toEqual([group.id, b.id]);
  });
});

describe('translateLayers', () => {
  it('moves paths and their path blocks', () => {
    const square = path('square', 'M 0 0 L 4 0 L 4 4 Z');
    const vl = new VectorLayer({ name: 'vector', children: [square] });
    const block = AnimationBlock.from({
      type: 'path',
      layerId: square.id,
      propertyName: 'pathData',
      startTime: 0,
      endTime: 100,
      fromValue: new Path('M 0 0 L 4 0 L 4 4 Z'),
      toValue: new Path('M 0 0 L 8 0 L 8 8 Z'),
    });
    const animation = withBlocks(block);
    const moved = translateLayers({ vectorLayer: vl, animation }, vl, [square.id], 2, 3);
    expect(pathDataOf(moved.vectorLayer, square.id)).toBe('M 2 3 L 6 3 L 6 7 Z');
    const [movedBlock] = moved.animation.blocks as PathAnimationBlock[];
    expect(movedBlock.fromValue?.getPathString()).toBe('M 2 3 L 6 3 L 6 7 Z');
    expect(movedBlock.toValue?.getPathString()).toBe('M 2 3 L 10 3 L 10 11 Z');
    // The document it moved from doesn't change.
    expect(pathDataOf(vl, square.id)).toBe('M 0 0 L 4 0 L 4 4 Z');
  });

  it('moves groups by their translation and its blocks', () => {
    const group = new GroupLayer({ name: 'group', children: [], translateX: 1 });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const block = AnimationBlock.from({
      type: 'number',
      layerId: group.id,
      propertyName: 'translateY',
      startTime: 0,
      endTime: 100,
      fromValue: 0,
      toValue: 10,
    });
    const animation = withBlocks(block);
    const moved = translateLayers({ vectorLayer: vl, animation }, vl, [group.id], 2, 3);
    const movedGroup = moved.vectorLayer.findLayerById(group.id) as GroupLayer;
    expect([movedGroup.translateX, movedGroup.translateY]).toEqual([3, 3]);
    const [movedBlock] = moved.animation.blocks;
    expect([movedBlock.fromValue, movedBlock.toValue]).toEqual([3, 13]);
  });

  it("converts the distance to the coordinates of the layer's parent", () => {
    const square = path('square', 'M 0 0 L 4 0 L 4 4 Z');
    // Scaled by 2 and turned a quarter turn clockwise, so right on the screen is up in the group.
    const group = new GroupLayer({
      name: 'group',
      children: [square],
      scaleX: 2,
      scaleY: 2,
      rotation: 90,
    });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const document = { vectorLayer: vl, animation: new Animation() };
    const moved = translateLayers(document, vl, [square.id], 4, 0);
    expect(pathDataOf(moved.vectorLayer, square.id)).toBe('M 0 -2 L 4 -2 L 4 2 Z');
  });

  it("doesn't change anything for no distance", () => {
    const vl = new VectorLayer({ name: 'vector', children: [path('a', 'M 0 0 L 1 1')] });
    const document = { vectorLayer: vl, animation: new Animation() };
    expect(translateLayers(document, vl, [vl.children[0].id], 0, 0)).toBe(document);
  });
});

describe('duplicateLayers', () => {
  it('copies layers above the originals, with new ids, unique names, and blocks', () => {
    const a = path('a', 'M 0 0 L 1 1');
    const child = path('group', 'M 0 0 L 2 2');
    const group = new GroupLayer({ name: 'group_1', children: [child] });
    const vl = new VectorLayer({ name: 'vector', children: [a, group] });
    const block = AnimationBlock.from({
      type: 'path',
      layerId: child.id,
      propertyName: 'pathData',
      startTime: 0,
      endTime: 100,
      fromValue: new Path('M 0 0 L 2 2'),
      toValue: new Path('M 0 0 L 3 3'),
    });
    const animation = withBlocks(block);
    const { document, layerIds } = duplicateLayers({ vectorLayer: vl, animation }, [
      group.id,
      a.id,
    ]);
    const names = (layer: Layer): string[] => [layer.name, ...layer.children.flatMap(names)];
    expect(names(document.vectorLayer)).toEqual([
      'vector',
      'a',
      'a_1',
      'group_1',
      'group',
      'group_2',
      'group_3',
    ]);
    expect(layerIds).toEqual([
      document.vectorLayer.children[1].id,
      document.vectorLayer.children[3].id,
    ]);
    const copiedChild = document.vectorLayer.children[3].children[0];
    expect(copiedChild.id).not.toBe(child.id);
    expect(document.animation.blocks).toHaveLength(2);
    expect(document.animation.blocks[1].layerId).toBe(copiedChild.id);
    expect(document.animation.blocks[1].id).not.toBe(block.id);
  });
});
