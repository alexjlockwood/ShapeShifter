import { AnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

function blockWith(interpolator: unknown) {
  return AnimationBlock.from({
    layerId: 'layer',
    propertyName: 'alpha',
    type: 'number',
    fromValue: 0,
    toValue: 1,
    interpolator: interpolator as string,
  });
}

describe('InterpolatorProperty', () => {
  it('keeps presets', () => {
    expect(blockWith('BOUNCE').interpolator).toBe('BOUNCE');
  });

  it('canonicalizes curves', () => {
    expect(blockWith('m0,0 c0.40001,0 0.2,1 1,1').interpolator).toBe('M 0 0 C 0.4 0 0.2 1 1 1');
  });

  it.each(['NOT_AN_INTERPOLATOR', 'M 0 0 L 1 0.5', 42, {}])(
    'replaces %p with the default preset',
    value => {
      expect(blockWith(value).interpolator).toBe('FAST_OUT_SLOW_IN');
    },
  );

  it("shows a preset's label, or Custom for a curve", () => {
    const property = blockWith('LINEAR').inspectableProperties.get('interpolator');
    expect(property?.getTypeName()).toBe('InterpolatorProperty');
    expect(property?.displayValueForValue('LINEAR')).toBe('Linear');
    expect(property?.displayValueForValue('M 0 0 C 0.4 0 0.2 1 1 1')).toBe('Custom');
  });

  it('survives cloning and JSON', () => {
    const block = blockWith('M 0 0 C 0.2 0 0 1.4 0.5 1.2 C 0.8 1 0.9 1 1 1');
    expect(block.clone().interpolator).toBe(block.interpolator);
    const json = JSON.parse(JSON.stringify(block.toJSON()));
    expect(AnimationBlock.from(json).interpolator).toBe(block.interpolator);
  });
});
