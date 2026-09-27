import { describe, expect, it } from 'vitest';

import { CURRENT_PROJECT_VERSION, getRequiredVersion } from './projectVersion';

function withInterpolators(...interpolators: unknown[]) {
  return {
    layers: { vectorLayer: { children: [] } },
    timeline: { animation: { blocks: interpolators.map(interpolator => ({ interpolator })) } },
  };
}

describe('getRequiredVersion', () => {
  it('returns 1 for an ordinary project', () => {
    const json = {
      layers: { vectorLayer: { children: [] } },
      timeline: { animation: { blocks: [] } },
    };
    expect(getRequiredVersion(json)).toBe(1);
  });

  it('returns 1 when every interpolator is a preset', () => {
    expect(getRequiredVersion(withInterpolators('LINEAR', 'FAST_OUT_SLOW_IN', 'BOUNCE'))).toBe(1);
  });

  it('returns 2 once an interpolator is a custom curve', () => {
    expect(getRequiredVersion(withInterpolators('LINEAR', 'M 0 0 C 0.4 0 0.2 1 1 1'))).toBe(2);
  });

  it("doesn't trip over odd JSON", () => {
    expect(getRequiredVersion(withInterpolators(undefined, 42, null))).toBe(1);
    expect(getRequiredVersion({ layers: { vectorLayer: {} }, timeline: { animation: {} } })).toBe(
      1,
    );
    expect(
      getRequiredVersion({
        layers: { vectorLayer: {} },
        timeline: { animation: { blocks: [null] } },
      }),
    ).toBe(1);
  });
});

describe('CURRENT_PROJECT_VERSION', () => {
  it('is the highest version a rule produces, so this build never warns about its own files', () => {
    expect(CURRENT_PROJECT_VERSION).toBe(2);
  });
});
