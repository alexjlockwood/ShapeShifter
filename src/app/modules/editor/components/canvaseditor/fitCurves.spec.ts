import { Point } from 'app/modules/editor/scripts/common';

import { Cubic, fitCurves } from './fitCurves';

function evaluate([p0, p1, p2, p3]: Cubic, t: number): Point {
  const s = 1 - t;
  const [b0, b1, b2, b3] = [s ** 3, 3 * t * s ** 2, 3 * t ** 2 * s, t ** 3];
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

/** How far the point is from the curves, by sampling them. */
function distanceToCurves(curves: Cubic[], point: Point) {
  let best = Infinity;
  for (const curve of curves) {
    for (let t = 0; t <= 1; t += 0.001) {
      const p = evaluate(curve, t);
      best = Math.min(best, Math.hypot(p.x - point.x, p.y - point.y));
    }
  }
  return best;
}

describe('fitCurves', () => {
  it('fits nothing to fewer than two points', () => {
    expect(fitCurves([], 1)).toEqual([]);
    expect(fitCurves([{ x: 1, y: 1 }], 1)).toEqual([]);
    expect(
      fitCurves(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        1,
      ),
    ).toEqual([]);
  });

  it('fits one curve to a straight line', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 2 * i }));
    const curves = fitCurves(points, 0.1);
    expect(curves).toHaveLength(1);
    expect(curves[0][0]).toEqual({ x: 0, y: 0 });
    expect(curves[0][3]).toEqual({ x: 19, y: 38 });
  });

  it('fits a wave within the error, with smooth joins', () => {
    const points = Array.from({ length: 200 }, (_, i) => ({
      x: i / 10,
      y: 3 * Math.sin(i / 10),
    }));
    const curves = fitCurves(points, 0.05);
    expect(curves.length).toBeGreaterThan(1);
    for (const point of points) {
      expect(distanceToCurves(curves, point)).toBeLessThan(0.05);
    }
    for (let i = 1; i < curves.length; i++) {
      // The handles on either side of each join point opposite ways.
      const join = curves[i][0];
      const before = curves[i - 1][2];
      const after = curves[i][1];
      const cross =
        (before.x - join.x) * (after.y - join.y) - (before.y - join.y) * (after.x - join.x);
      expect(Math.abs(cross)).toBeLessThan(1e-9);
      expect(curves[i - 1][3]).toEqual(join);
    }
  });
});
