import { range } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createCurveEasing, curveToString, parseCurve } from './CustomInterpolator';
import {
  findPreset,
  getInterpolateFn,
  INTERPOLATORS,
  PRESET_CURVES,
  resolveInterpolator,
} from './Interpolator';

describe('PRESET_CURVES', () => {
  it('has a curve for every preset', () => {
    expect(Object.keys(PRESET_CURVES).sort()).toEqual(INTERPOLATORS.map(i => i.value).sort());
  });

  it.each(INTERPOLATORS.map(i => [i.value, i] as const))(
    "matches %s's interpolateFn",
    (value, preset) => {
      const easing = createCurveEasing(PRESET_CURVES[value]);
      // The cosine is approximated by a single cubic.
      const tolerance = value === 'ACCELERATE_DECELERATE' ? 0.01 : 1e-3;
      for (const f of range(0, 1.0001, 0.01)) {
        expect(Math.abs(easing(f) - preset.interpolateFn(f))).toBeLessThan(tolerance);
      }
    },
  );

  it.each(INTERPOLATORS.map(i => i.value))('writes %s as a valid custom curve', value => {
    const curve = parseCurve(curveToString(PRESET_CURVES[value]));
    expect(curve).toHaveLength(PRESET_CURVES[value].length);
  });
});

describe('resolveInterpolator', () => {
  it('resolves presets by name', () => {
    const resolved = resolveInterpolator('LINEAR');
    expect(resolved.type).toBe('preset');
    expect(resolved.type === 'preset' && resolved.preset).toBe(findPreset('LINEAR'));
    expect(resolved.curve).toBe(PRESET_CURVES.LINEAR);
  });

  it('resolves curves, with their canonical string', () => {
    const resolved = resolveInterpolator('m0,0 c0.4,0 0.2,1 1,1');
    expect(resolved.type).toBe('custom');
    expect(resolved.type === 'custom' && resolved.value).toBe('M 0 0 C 0.4 0 0.2 1 1 1');
  });

  it.each(['NOT_AN_INTERPOLATOR', 'M 0 0 L 2 2', '', undefined, 42, null])(
    'falls back to the default preset for %p',
    value => {
      const resolved = resolveInterpolator(value);
      expect(resolved.type === 'preset' && resolved.preset).toBe(INTERPOLATORS[0]);
    },
  );

  it('caches what it resolves', () => {
    const value = 'M 0 0 C 0.1 0.2 0.3 0.4 1 1';
    expect(resolveInterpolator(value)).toBe(resolveInterpolator(value));
    expect(getInterpolateFn(value)).toBe(getInterpolateFn(value));
  });
});

describe('getInterpolateFn', () => {
  it("returns a preset's function", () => {
    expect(getInterpolateFn('ACCELERATE')).toBe(findPreset('ACCELERATE')?.interpolateFn);
  });

  it("returns a curve's easing", () => {
    const fn = getInterpolateFn('M 0 0 L 0.5 0.8 L 1 1');
    expect(fn(0.25)).toBeCloseTo(0.4, 4);
  });
});
