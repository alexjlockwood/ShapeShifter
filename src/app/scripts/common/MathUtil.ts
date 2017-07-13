import { Matrix, Point } from '.';

/** Returns the floor modulus of the integer argument. */
export function floorMod(num: number, maxNum: number) {
  return (num % maxNum + maxNum) % maxNum;
}

/** Linearly interpolate between point a and point b using time t. */
export function lerp(a: number, b: number, t: number): number;
export function lerp(a: [number, number], b: [number, number], t: number): [number, number];
export function lerp(a: number | [number, number], b: number | [number, number], t: number) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * t;
  } else {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] as [number, number];
  }
}

/** Returns true if the points are collinear. */
export function areCollinear(...points: Array<{ readonly x: number; readonly y: number }>) {
  if (points.length < 3) {
    return true;
  }
  const { x: a, y: b } = points[0];
  const { x: m, y: n } = points[1];
  return points.every(({ x, y }: Point) => {
    // The points are collinear if the area of the triangle they form
    // is equal to (or in this case, close to) zero.
    return Math.abs(a * (n - y) + m * (y - b) + x * (b - n)) < 1e-9;
  });
}

/** Applies a list of transformation matrices to the specified point. */
export function transformPoint(
  point: { readonly x: number; readonly y: number },
  ...matrices: Matrix[]
) {
  return matrices.reduce((p: Point, m: Matrix) => {
    // [a c e]   [p.x]
    // [b d f] * [p.y]
    // [0 0 1]   [ 1 ]
    return { x: m.a * p.x + m.c * p.y + m.e * 1, y: m.b * p.x + m.d * p.y + m.f * 1 };
  }, point);
}

function instanceOfPoint(p: any): p is Point {
  return 'x' in p && 'y' in p;
}

/** Calculates the distance between two points. */
export function distance(p1: [number, number], p2: [number, number]): number;
export function distance(p1: Point, p2: Point): number;
export function distance(p1: [number, number] | Point, p2: [number, number] | Point) {
  const dx = instanceOfPoint(p1) && instanceOfPoint(p2) ? p1.x - p2.x : p1[0] - p2[0];
  const dy = instanceOfPoint(p1) && instanceOfPoint(p2) ? p1.y - p2.y : p1[1] - p2[1];
  return Math.sqrt(dx ** 2 + dy ** 2);
}

/** Returns true if the two points are equal. */
export function arePointsEqual(p1: Point, p2: Point) {
  return p1 && p2 && distance(p1, p2) < 1e-9;
}
