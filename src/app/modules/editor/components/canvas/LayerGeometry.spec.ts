import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path, PathUtil } from 'app/modules/editor/model/paths';
import { Matrix, Rect } from 'app/modules/editor/scripts/common';
import { fromPathOpString } from 'test/PathUtil';

import { getLayerBounds, getPathLayerBounds } from './LayerGeometry';

function path(name: string, pathData: Path | string, props: Partial<PathLayer> = {}) {
  const data = typeof pathData === 'string' ? new Path(pathData) : pathData;
  return new PathLayer({ name, children: [], pathData: data, ...props });
}

/**
 * The bounds as getLayerBounds used to find them, by building each path transformed into the
 * viewport and asking for its bounding box, which was too slow to run on every frame.
 */
function getBoundsByTransformedPaths(vl: VectorLayer, layerId: string): Rect | undefined {
  const layer = vl.findLayerById(layerId);
  if (!layer) {
    return undefined;
  }
  let bounds: Rect | undefined;
  (function recurseFn(current: Layer, parentMatrix: Matrix) {
    const transforms = LayerUtil.getLayerTransforms(current);
    const matrix = transforms.length ? Matrix.flatten([parentMatrix, ...transforms]) : parentMatrix;
    if (current instanceof PathLayer || current instanceof ClipPathLayer) {
      const box = current.pathData?.mutate().transform(matrix).build().getBoundingBox();
      if (box && [box.l, box.t, box.r, box.b].every(Number.isFinite)) {
        bounds = bounds
          ? {
              l: Math.min(bounds.l, box.l),
              t: Math.min(bounds.t, box.t),
              r: Math.max(bounds.r, box.r),
              b: Math.max(bounds.b, box.b),
            }
          : { ...box };
      }
      return;
    }
    current.children.forEach(child => recurseFn(child, matrix));
  })(layer, LayerUtil.getParentTransformForLayer(vl, layerId));
  return bounds;
}

/**
 * Returns how far getLayerBounds is from the bounds of the transformed paths. getLayerBounds
 * bounds the drawn commands, whose points are rounded to 9 decimals, and a transformed path's
 * getBoundingBox bounds them as they were parsed (e.g. an arc's curves), so they can differ past
 * the 8th decimal.
 */
function getBoundsError(vl: VectorLayer, layer: Layer) {
  const bounds = getLayerBounds(vl, layer.id);
  const expected = getBoundsByTransformedPaths(vl, layer.id);
  if (!bounds || !expected) {
    return bounds === expected ? 0 : Infinity;
  }
  return Math.max(
    ...(['l', 't', 'r', 'b'] as const).map(key => Math.abs(bounds[key] - expected[key])),
  );
}

describe('getLayerBounds', () => {
  const PATHS = [
    'M 0 10 C 0 0 10 0 10 10',
    'M 2 2 Q 12 -6 20 8 T 4 20 Z',
    'M 3 3 H 17 V 9 A 5 5 0 0 1 3 9 Z M 6 5 L 8 5 L 7 7 Z',
    'M 1 1 C 1 1 9 9 9 9',
    'M 4 4 C 4 4 4 4 12 2',
    'M 5 5 L 5 5',
    'M 5 5',
    'M 0.123456 7.654321 C 3.3333 -2.7182 8.1414 11.4142 12.0001 3.5',
  ];

  it('matches the bounds of the paths transformed into the viewport', () => {
    const paths = PATHS.map((d, i) => path(`p${i}`, d));
    // A path with a transform of its own, in a group in a rotated, flipped, and scaled group.
    paths.push(path('own', 'M 0 0 C 6 -4 10 4 16 0', { rotation: 15, scaleX: 2, pivotX: 4 }));
    const inner = new GroupLayer({
      name: 'inner',
      children: paths,
      rotation: 37,
      scaleX: 1.5,
      scaleY: -0.4,
      pivotX: 6,
      pivotY: 3,
    });
    const outer = new GroupLayer({
      name: 'outer',
      children: [inner],
      rotation: -110,
      translateX: 12.5,
      translateY: -3.25,
      scaleY: 2.2,
    });
    const vl = new VectorLayer({ name: 'vector', children: [outer], width: 24, height: 24 });
    for (const layer of [...paths, inner, outer]) {
      expect(getBoundsError(vl, layer)).toBeLessThan(1e-8);
    }
    // A path with only a move has no bounds, either way.
    expect(getLayerBounds(vl, paths[6].id)).toBeUndefined();
    // Paths without an arc have the same bounds exactly.
    const [curve] = paths;
    expect(getLayerBounds(vl, curve.id)).toEqual(getBoundsByTransformedPaths(vl, curve.id));
  });

  it('matches them for an interpolated path, like playback draws', () => {
    const start = new Path('M 0 0 C 4 -8 12 -8 16 0 L 8 12 Z');
    const end = new Path('M 2 4 C 10 -2 14 6 18 2 L 4 16 Z');
    const halfway = path('halfway', PathUtil.interpolate(start, end, 0.37));
    const group = new GroupLayer({ name: 'group', children: [halfway], rotation: 63, scaleX: 3 });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    expect(getBoundsError(vl, group)).toBeLessThan(1e-8);
  });

  it("matches them for a path that's been split and converted in action mode", () => {
    const edited = path(
      'edited',
      fromPathOpString('M 0 0 L 10 0 C 14 4 14 10 8 12 Z', 'SIH 0 2 CV 0 1 C'),
    );
    const group = new GroupLayer({ name: 'group', children: [edited], rotation: 45, scaleY: 0.5 });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    expect(getBoundsError(vl, edited)).toBeLessThan(1e-8);
  });

  it('keeps a line turned a quarter turn exactly upright, so its width is 0', () => {
    const line = path('line', 'M 2 5 L 12 5');
    const group = new GroupLayer({ name: 'group', children: [line], rotation: 90 });
    const vl = new VectorLayer({ name: 'vector', children: [group] });
    const bounds = getLayerBounds(vl, line.id);
    expect(bounds && bounds.r - bounds.l).toBe(0);
    expect(bounds).toEqual(getBoundsByTransformedPaths(vl, line.id));
  });

  it('bounds the same path again once its transform changes', () => {
    const pathData = new Path('M 0 0 L 10 0 L 10 4 Z');
    const before = path('before', pathData);
    const vl1 = new VectorLayer({
      name: 'vector',
      children: [new GroupLayer({ name: 'group', children: [before], translateX: 3 })],
    });
    expect(getLayerBounds(vl1, before.id)).toEqual({ l: 3, t: 0, r: 13, b: 4 });
    // The second time, the path's bounds come from the cache.
    expect(getLayerBounds(vl1, before.id)).toEqual({ l: 3, t: 0, r: 13, b: 4 });
    expect(getPathLayerBounds(vl1, new Set()).get(before.id)).toEqual({ l: 3, t: 0, r: 13, b: 4 });

    const after = path('after', pathData);
    const vl2 = new VectorLayer({
      name: 'vector',
      children: [new GroupLayer({ name: 'group', children: [after], scaleX: 2 })],
    });
    expect(getLayerBounds(vl2, after.id)).toEqual({ l: 0, t: 0, r: 20, b: 4 });
  });
});
