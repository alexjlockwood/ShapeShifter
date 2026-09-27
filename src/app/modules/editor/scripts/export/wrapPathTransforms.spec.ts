import {
  ClipPathLayer,
  GroupLayer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { wrapPathTransforms } from './wrapPathTransforms';

function newPath(name: string, props: Partial<PathLayer> = {}) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path('M 0 0 L 4 0 L 4 2 Z'),
    fillColor: '#000000',
    ...props,
  });
}

function numberBlock(layerId: string, propertyName: string) {
  return AnimationBlock.from({ type: 'number', layerId, propertyName, fromValue: 0, toValue: 1 });
}

describe('wrapPathTransforms', () => {
  it('returns the layers and the animation as they are without transformed paths', () => {
    const vl = new VectorLayer({
      name: 'vector',
      children: [newPath('plain'), newPath('pivoted', { pivotX: 12, pivotY: 12 })],
    });
    const animation = new Animation();
    animation.blocks = [numberBlock(vl.children[0].id, 'fillAlpha')];
    expect(wrapPathTransforms(vl)).toBe(vl);
    const wrapped = wrapPathTransforms(vl, animation);
    expect(wrapped.vectorLayer).toBe(vl);
    expect(wrapped.animation).toBe(animation);
  });

  it('wraps a transformed path in a group with its transform, in its place', () => {
    const mask = new ClipPathLayer({
      name: 'mask',
      children: [],
      pathData: new Path('M 0 0 L 1 1'),
    });
    const rotated = newPath('rotated', { rotation: 45, pivotX: 2, pivotY: 1, translateY: 3 });
    const group = new GroupLayer({ name: 'group', children: [mask, rotated, newPath('after')] });
    // A layer that already has the name the group would get.
    const vl = new VectorLayer({
      name: 'vector',
      children: [group, newPath('rotated_transform')],
    });

    const wrapped = wrapPathTransforms(vl);
    const wrappedGroup = wrapped.findLayerById(group.id) as GroupLayer;
    expect(wrappedGroup.children.map(l => l.name)).toEqual([
      'mask',
      'rotated_transform_1',
      'after',
    ]);
    const wrapper = wrappedGroup.children[1] as GroupLayer;
    expect(wrapper).toBeInstanceOf(GroupLayer);
    expect(wrapper.id).not.toBe(rotated.id);
    expect(wrapper).toMatchObject({ rotation: 45, pivotX: 2, pivotY: 1, translateY: 3, scaleX: 1 });
    const inner = wrapper.children[0] as PathLayer;
    expect(inner.id).toBe(rotated.id);
    expect(inner.name).toBe('rotated');
    expect(LayerUtil.pathUsesTransform(inner)).toBe(false);
    expect(inner.pivotX).toBe(0);
    // It's drawn in the same place.
    expect(
      LayerUtil.getCanvasTransformForLayer(wrapped, rotated.id).equals(
        LayerUtil.getCanvasTransformForLayer(vl, rotated.id),
      ),
    ).toBe(true);
    // The original doesn't change.
    expect((vl.findLayerById(rotated.id) as PathLayer).rotation).toBe(45);
  });

  it("moves the path's transform blocks to the group, and keeps its other blocks", () => {
    const path = newPath('path');
    const vl = new VectorLayer({ name: 'vector', children: [path] });
    const animation = new Animation();
    const rotation = numberBlock(path.id, 'rotation');
    const alpha = numberBlock(path.id, 'fillAlpha');
    animation.blocks = [rotation, alpha];

    const wrapped = wrapPathTransforms(vl, animation);
    const wrapper = wrapped.vectorLayer.children[0] as GroupLayer;
    expect(wrapper.name).toBe('path_transform');
    expect(wrapped.animation.blocks.map(b => [b.id, b.layerId, b.propertyName])).toEqual([
      [rotation.id, wrapper.id, 'rotation'],
      [alpha.id, path.id, 'fillAlpha'],
    ]);
    expect(animation.blocks[0].layerId).toBe(path.id);
  });
});
