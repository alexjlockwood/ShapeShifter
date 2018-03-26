import { solve } from './numeric';
export function distort(
  sourcePoints: ReadonlyArray<[number, number]>,
  targetPoints: ReadonlyArray<[number, number]>,
) {
  const a = [];
  const b = [];
  for (let i = 0, n = sourcePoints.length; i < n; ++i) {
    const s = sourcePoints[i];
    const t = targetPoints[i];
    a.push([s[0], s[1], 1, 0, 0, 0, -s[0] * t[0], -s[1] * t[0]]), b.push(t[0]);
    a.push([0, 0, 0, s[0], s[1], 1, -s[0] * t[1], -s[1] * t[1]]), b.push(t[1]);
  }

  const X = solve(a, b, true);
  // prettier-ignore
  return [
      X[0], X[3], 0, X[6],
      X[1], X[4], 0, X[7],
         0,    0, 1,    0,
      X[2], X[5], 0,    1,
    ].map((x) => Math.round(x * 10e6) / 10e6);
}

export class Transformer {
  private readonly matrix: Matrix3D;

  constructor(sourcePoints: [number, number][], targetPoints: [number, number][]) {
    const a = [];
    const b = [];
    for (let i = 0, n = sourcePoints.length; i < n; ++i) {
      const s = sourcePoints[i];
      const t = targetPoints[i];
      a.push([s[0], s[1], 1, 0, 0, 0, -s[0] * t[0], -s[1] * t[0]]), b.push(t[0]);
      a.push([0, 0, 0, s[0], s[1], 1, -s[0] * t[1], -s[1] * t[1]]), b.push(t[1]);
    }

    const X = solve(a, b, true);
    // prettier-ignore
    this.matrix = ([
        X[0], X[3], 0, X[6],
        X[1], X[4], 0, X[7],
           0,    0, 1,    0,
        X[2], X[5], 0,    1,
      ]).map(x => Math.round(x * 10e6) / 10e6) as Matrix3D;

    // prettier-ignore
    const [m11, m12, m13, m14, m21, m22, m23, m24, m31, m32, m33, m34, m41, m42, m43, m44] = this.matrix;
    const translation = [m41, m42];
    const sx = Math.hypot(m11, m12);
    const sy = Math.hypot(m21, m22);
    const scale = [sx, sy];
    const rotation = Math.atan2(sy * m12, sx * m22);
  }

  transform() {}
}

// prettier-ignore
type Matrix3D = [
  number,  number,  number,  number,
  number,  number,  number,  number,
  number,  number,  number,  number,
  number,  number,  number,  number
];
