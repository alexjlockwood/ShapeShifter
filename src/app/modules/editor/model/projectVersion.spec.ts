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

describe('getRequiredVersion with transforms on paths', () => {
  function project(children: unknown[], blocks: unknown[] = []) {
    return {
      layers: { vectorLayer: { id: 'vl', type: 'vector', children } },
      timeline: { animation: { blocks } },
    };
  }
  const path = (props: object = {}) => ({
    id: 'p',
    type: 'path',
    pathData: 'M 0 0 L 1 1',
    ...props,
  });
  const rotationBlock = (layerId: string) => ({
    layerId,
    propertyName: 'rotation',
    fromValue: 0,
    toValue: 90,
    interpolator: 'LINEAR',
  });

  it('returns 1 for paths without a transform, or with only a pivot', () => {
    expect(getRequiredVersion(project([path()]))).toBe(1);
    expect(getRequiredVersion(project([path({ pivotX: 12, pivotY: 12 })]))).toBe(1);
    // Groups have always had transforms.
    const group = { id: 'g', type: 'group', rotation: 45, children: [path()] };
    expect(getRequiredVersion(project([group], [rotationBlock('g')]))).toBe(1);
  });

  it('returns 3 once a path is rotated, scaled, or translated', () => {
    expect(getRequiredVersion(project([path({ rotation: 45 })]))).toBe(3);
    expect(getRequiredVersion(project([path({ scaleY: 2 })]))).toBe(3);
    const group = { id: 'g', type: 'group', children: [path({ translateX: 1 })] };
    expect(getRequiredVersion(project([group]))).toBe(3);
  });

  it("returns 3 once a path's transform is animated", () => {
    expect(getRequiredVersion(project([path()], [rotationBlock('p')]))).toBe(3);
  });

  it('returns 3 for a transformed path with a custom curve', () => {
    const curve = { ...rotationBlock('p'), interpolator: 'M 0 0 C 0.4 0 0.2 1 1 1' };
    expect(getRequiredVersion(project([path()], [curve]))).toBe(3);
    expect(getRequiredVersion(project([path({ rotation: 0 })], [curve]))).toBe(3);
  });

  it('returns 2 for a custom curve without transformed paths', () => {
    const curve = {
      layerId: 'p',
      propertyName: 'fillAlpha',
      interpolator: 'M 0 0 C 0.4 0 0.2 1 1 1',
    };
    expect(getRequiredVersion(project([path({ pivotX: 3 })], [curve]))).toBe(2);
  });

  it("doesn't trip over odd layers", () => {
    expect(getRequiredVersion(project([null, 5, { type: 'path', children: 'x' }]))).toBe(1);
  });
});

describe('CURRENT_PROJECT_VERSION', () => {
  it('is the highest version a rule produces, so this build never warns about its own files', () => {
    expect(CURRENT_PROJECT_VERSION).toBe(3);
  });
});
