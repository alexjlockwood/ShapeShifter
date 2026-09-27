import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { AnimationRenderer } from './AnimationRenderer';

function path(name: string) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path('M 0 0 L 1 1'),
    fillColor: '#000',
  });
}

function rotate(layerId: string) {
  const animation = new Animation({ duration: 100 });
  animation.blocks = [
    AnimationBlock.from({
      layerId,
      propertyName: 'rotation',
      type: 'number',
      startTime: 0,
      endTime: 100,
      interpolator: 'LINEAR',
      fromValue: 0,
      toValue: 90,
    }),
  ];
  return animation;
}

describe('AnimationRenderer', () => {
  it('copies the animated layers and their ancestors, and shares the rest', () => {
    const still = path('still');
    const inner = path('inner');
    const animated = new GroupLayer({ name: 'animated', children: [inner] });
    const other = new GroupLayer({ name: 'other', children: [path('other_path')] });
    const vl = new VectorLayer({ name: 'vector', children: [still, animated, other] });

    const rendered = new AnimationRenderer(vl, rotate(animated.id)).setCurrentTime(50);

    expect(rendered).not.toBe(vl);
    expect(rendered.findLayerById(animated.id)).not.toBe(animated);
    expect((rendered.findLayerById(animated.id) as GroupLayer).rotation).toBe(45);
    expect(animated.rotation).toBe(0);
    expect(rendered.findLayerById(still.id)).toBe(still);
    expect(rendered.findLayerById(inner.id)).toBe(inner);
    expect(rendered.findLayerById(other.id)).toBe(other);
  });

  it('returns the vector layer itself when nothing is animated', () => {
    const vl = new VectorLayer({ name: 'vector', children: [path('a')] });
    expect(new AnimationRenderer(vl, new Animation()).setCurrentTime(0)).toBe(vl);
  });
});
