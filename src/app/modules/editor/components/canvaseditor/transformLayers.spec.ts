import { GroupLayer, Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import {
  duplicateLayers,
  getTopmostLayerIds,
  rotationAround,
  scalingAround,
  transformLayers,
  translateLayers,
} from './transformLayers';

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
    expect(getTopmostLayerIds(vl, [b.id, a.id, group.id])).toEqual([group.id, b.id]);
  });

  it("gives the layers in the vector layer for the vector layer, which can't move", () => {
    const a = path('a', 'M 0 0 L 1 1');
    const group = new GroupLayer({ name: 'group', children: [path('b', 'M 0 0 L 1 1')] });
    const vl = new VectorLayer({ name: 'vector', children: [a, group] });
    expect(getTopmostLayerIds(vl, [vl.id, a.id])).toEqual([a.id, group.id]);
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

  it('converts the distance with the transform as drawn, which animations change', () => {
    const square = path('square', 'M 0 0 L 4 0 L 4 4 Z');
    const group = new GroupLayer({ name: 'group', children: [square] });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    // As drawn at a time when a block has scaled the group by 2.
    const rendered = vl.clone();
    const scaled = group.clone();
    scaled.scaleX = 2;
    scaled.scaleY = 2;
    rendered.children = [scaled];
    const document = { vectorLayer: vl, animation: new Animation() };
    const moved = translateLayers(document, rendered, [square.id], 4, 0);
    expect(pathDataOf(moved.vectorLayer, square.id)).toBe('M 2 0 L 6 0 L 6 4 Z');
  });

  it('rounds the translations of groups', () => {
    const group = new GroupLayer({ name: 'group', children: [], rotation: 30 });
    const outer = new GroupLayer({ name: 'outer', children: [group], rotation: 45 });
    const vl = new VectorLayer({ name: 'vector', children: [outer] });
    const document = { vectorLayer: vl, animation: new Animation() };
    const moved = translateLayers(document, vl, [group.id], 1, 0);
    const movedGroup = moved.vectorLayer.findLayerById(group.id) as GroupLayer;
    // cos(45°) and -sin(45°), to 3 decimals.
    expect([movedGroup.translateX, movedGroup.translateY]).toEqual([0.707, -0.707]);
  });

  it("doesn't change anything for no distance", () => {
    const vl = new VectorLayer({ name: 'vector', children: [path('a', 'M 0 0 L 1 1')] });
    const document = { vectorLayer: vl, animation: new Animation() };
    expect(translateLayers(document, vl, [vl.children[0].id], 0, 0)).toBe(document);
  });
});

describe('duplicateLayers', () => {
  it('copies layers with new ids, unique names, and blocks', () => {
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
    expect(names(document.vectorLayer)).toEqual([
      'vector',
      'a',
      'group_1',
      'group',
      'a_1',
      'group_2',
      'group_3',
    ]);
    expect(layerIds).toEqual([
      document.vectorLayer.children[2].id,
      document.vectorLayer.children[3].id,
    ]);
    const copiedChild = document.vectorLayer.children[3].children[0];
    expect(copiedChild.id).not.toBe(child.id);
    expect(document.animation.blocks).toHaveLength(2);
    expect(document.animation.blocks[1].layerId).toBe(copiedChild.id);
    expect(document.animation.blocks[1].id).not.toBe(block.id);
  });

  it('puts the copies above the topmost original in each group, in the same order', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(name => path(name, 'M 0 0 L 1 1'));
    const e = path('e', 'M 0 0 L 1 1');
    const group = new GroupLayer({ name: 'group', children: [e] });
    const vl = new VectorLayer({ name: 'vector', children: [a, b, c, group, d] });
    const document = { vectorLayer: vl, animation: new Animation() };
    const duplicated = duplicateLayers(document, [c.id, e.id, a.id]);
    expect(names(duplicated.document.vectorLayer)).toEqual([
      'vector',
      'a',
      'b',
      'c',
      'a_1',
      'c_1',
      'group',
      'e',
      'e_1',
      'd',
    ]);
  });

  it('hides the copies of hidden layers', () => {
    const a = path('a', 'M 0 0 L 1 1');
    const hiddenChild = path('hiddenChild', 'M 0 0 L 1 1');
    const group = new GroupLayer({ name: 'group', children: [hiddenChild] });
    const vl = new VectorLayer({ name: 'vector', children: [a, group] });
    const document = { vectorLayer: vl, animation: new Animation() };
    const hidden = new Set([hiddenChild.id]);
    expect(duplicateLayers(document, [a.id], hidden).hiddenLayerIds).toBe(hidden);
    const duplicated = duplicateLayers(document, [group.id], hidden);
    const copiedChild = duplicated.document.vectorLayer.children[2].children[0];
    expect(duplicated.hiddenLayerIds).toEqual(new Set([hiddenChild.id, copiedChild.id]));
  });
});

describe('transformLayers', () => {
  it('transforms every path in the layers in its own coordinates, and their path blocks', () => {
    const square = path('square', 'M 0 0 L 4 0 L 4 4 L 0 4 Z');
    // Scaled by 2, so the square covers 0 to 8 on the screen.
    const group = new GroupLayer({ name: 'group', children: [square], scaleX: 2, scaleY: 2 });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const block = AnimationBlock.from({
      type: 'path',
      layerId: square.id,
      propertyName: 'pathData',
      startTime: 0,
      endTime: 100,
      fromValue: new Path('M 0 0 L 4 0 L 4 4 L 0 4 Z'),
      toValue: new Path('M 0 0 L 2 0 L 2 2 L 0 2 Z'),
    });
    const document = { vectorLayer: vl, animation: withBlocks(block) };
    // Twice as wide on the screen, from its left edge.
    const scaled = transformLayers(document, vl, [group.id], scalingAround({ x: 0, y: 0 }, 2, 1));
    expect(pathDataOf(scaled.vectorLayer, square.id)).toBe('M 0 0 L 8 0 L 8 4 L 0 4 Z');
    const [scaledBlock] = scaled.animation.blocks as PathAnimationBlock[];
    expect(scaledBlock.toValue?.getPathString()).toBe('M 0 0 L 4 0 L 4 2 L 0 2 Z');
    // The group keeps its own transform.
    expect((scaled.vectorLayer.findLayerById(group.id) as GroupLayer).scaleX).toBe(2);
  });

  it('rotates around a point, clockwise on the screen', () => {
    const line = path('line', 'M 12 12 L 16 12');
    const vl = new VectorLayer({ name: 'vector', children: [line] });
    const document = { vectorLayer: vl, animation: new Animation() };
    const rotated = transformLayers(document, vl, [line.id], rotationAround({ x: 12, y: 12 }, 90));
    expect(pathDataOf(rotated.vectorLayer, line.id)).toBe('M 12 12 L 12 16');
  });
});

function names(layer: Layer): string[] {
  return [layer.name, ...layer.children.flatMap(names)];
}
