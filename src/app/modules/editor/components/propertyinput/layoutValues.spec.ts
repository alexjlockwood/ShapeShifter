import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { areLayoutsEqual, getLayoutValues, setLayoutValue } from './layoutValues';

function path(name: string, pathData: string) {
  return new PathLayer({ name, children: [], pathData: new Path(pathData), fillColor: '#000' });
}

function documentOf(vl: VectorLayer, ...blocks: AnimationBlock[]) {
  const animation = new Animation();
  animation.blocks = blocks;
  return { vectorLayer: vl, animation };
}

function pathDataOf(vl: VectorLayer, layerId: string) {
  return (vl.findLayerById(layerId) as PathLayer).pathData?.getPathString();
}

describe('getLayoutValues', () => {
  it("is the bounds of the layer's paths on the canvas", () => {
    const square = path('square', 'M 2 4 L 6 4 L 6 10 L 2 10 Z');
    const group = new GroupLayer({
      name: 'group',
      children: [square],
      translateX: 10,
      scaleY: 2,
    });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    expect(getLayoutValues(vl, square.id)).toEqual({ x: 12, y: 8, w: 4, h: 12 });
    expect(getLayoutValues(vl, group.id)).toEqual({ x: 12, y: 8, w: 4, h: 12 });
  });

  it("is undefined for the vector layer, and for a layer that doesn't have a path", () => {
    const empty = new GroupLayer({ name: 'empty', children: [] });
    const vl = new VectorLayer({ name: 'vector', children: [empty, path('a', 'M 0 0 L 1 1')] });
    expect(getLayoutValues(vl, vl.id)).toBeUndefined();
    expect(getLayoutValues(vl, empty.id)).toBeUndefined();
  });
});

describe('setLayoutValue', () => {
  it('moves a layer to a position, with its path blocks', () => {
    const square = path('square', 'M 2 2 L 6 2 L 6 6 L 2 6 Z');
    const vl = new VectorLayer({ name: 'vector', children: [square] });
    const block = AnimationBlock.from({
      layerId: square.id,
      propertyName: 'pathData',
      type: 'path',
      startTime: 0,
      endTime: 100,
      fromValue: new Path('M 2 2 L 6 2 L 6 6 L 2 6 Z'),
      toValue: new Path('M 0 0 L 8 0 L 8 8 L 0 8 Z'),
    });
    const moved = setLayoutValue(documentOf(vl, block), vl, square.id, 'x', 10);
    expect(moved && pathDataOf(moved.vectorLayer, square.id)).toBe('M 10 2 L 14 2 L 14 6 L 10 6 Z');
    const [movedBlock] = moved?.animation.blocks ?? [];
    expect((movedBlock as PathAnimationBlock).toValue?.getPathString()).toBe(
      'M 8 0 L 16 0 L 16 8 L 8 8 Z',
    );
    const down = setLayoutValue(documentOf(vl), vl, square.id, 'y', 0);
    expect(down && pathDataOf(down.vectorLayer, square.id)).toBe('M 2 0 L 6 0 L 6 4 L 2 4 Z');
  });

  it('moves a group by its translation', () => {
    const group = new GroupLayer({ name: 'group', children: [path('a', 'M 2 2 L 6 6')] });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const moved = setLayoutValue(documentOf(vl), vl, group.id, 'x', 5);
    const movedGroup = moved?.vectorLayer.findLayerById(group.id) as GroupLayer;
    expect([movedGroup.translateX, movedGroup.translateY]).toEqual([3, 0]);
  });

  it('resizes a layer from its top left corner', () => {
    const square = path('square', 'M 2 2 L 6 2 L 6 6 L 2 6 Z');
    const vl = new VectorLayer({ name: 'vector', children: [square] });
    const wider = setLayoutValue(documentOf(vl), vl, square.id, 'w', 8);
    expect(wider && pathDataOf(wider.vectorLayer, square.id)).toBe('M 2 2 L 10 2 L 10 6 L 2 6 Z');
    const taller = setLayoutValue(documentOf(vl), vl, square.id, 'h', 2);
    expect(taller && pathDataOf(taller.vectorLayer, square.id)).toBe('M 2 2 L 6 2 L 6 4 L 2 4 Z');
  });

  it("does nothing for a size that can't be scaled, or a value that's the same", () => {
    const line = path('line', 'M 2 2 L 6 2');
    const vl = new VectorLayer({ name: 'vector', children: [line] });
    const document = documentOf(vl);
    // A horizontal line has no height to scale.
    expect(setLayoutValue(document, vl, line.id, 'h', 4)).toBeUndefined();
    expect(setLayoutValue(document, vl, line.id, 'w', 0)).toBeUndefined();
    expect(setLayoutValue(document, vl, line.id, 'w', 4)).toBeUndefined();
    expect(setLayoutValue(document, vl, line.id, 'x', 2)).toBeUndefined();
    expect(setLayoutValue(document, vl, line.id, 'x', NaN)).toBeUndefined();
    expect(setLayoutValue(document, vl, vl.id, 'x', 3)).toBeUndefined();
  });
});

describe('areLayoutsEqual', () => {
  it('compares the values', () => {
    expect(areLayoutsEqual({ x: 1, y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: 3, h: 4 })).toBe(true);
    expect(areLayoutsEqual({ x: 1, y: 2, w: 3, h: 4 }, { x: 1, y: 2, w: 3, h: 5 })).toBe(false);
    expect(areLayoutsEqual(undefined, undefined)).toBe(true);
    expect(areLayoutsEqual({ x: 1, y: 2, w: 3, h: 4 }, undefined)).toBe(false);
  });
});
