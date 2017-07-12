import { Matrix, Point } from '.';

const EPSILON = 1e-8;

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

/** Clamps the specified number between a min and max value. */
export function clamp(num: number, min: number, max: number) {
  if (num < min) {
    return min;
  } else if (num > max) {
    return max;
  } else {
    return num;
  }
}

/** Returns true if the points are collinear. */
export function areCollinear(...points: Point[]) {
  if (points.length < 3) {
    return true;
  }
  const { x: a, y: b } = points[0];
  const { x: m, y: n } = points[1];
  return points.every(({ x, y }: Point) => {
    // The points are collinear if the area of the triangle they form
    // is equal to (or in this case, close to) zero.
    return Math.abs(a * (n - y) + m * (y - b) + x * (b - n)) < EPSILON;
  });
}

/** Applies a list of transformation matrices to the specified point. */
export function transformPoint(point: Point, ...matrices: Matrix[]): Point {
  return matrices.reduce((p: Point, m: Matrix) => {
    // [a c e]   [p.x]
    // [b d f] * [p.y]
    // [0 0 1]   [ 1 ]
    return new Point(m.a * p.x + m.c * p.y + m.e * 1, m.b * p.x + m.d * p.y + m.f * 1);
  }, new Point(point.x, point.y));
}

/** Calculates the distance between two points. */
export function distance(p1: [number, number], p2: [number, number]): number;
export function distance(p1: Point, p2: Point): number;
export function distance(p1: [number, number] | Point, p2: [number, number] | Point) {
  const dx = p1 instanceof Point && p2 instanceof Point ? p1.x - p2.x : p1[0] - p2[0];
  const dy = p1 instanceof Point && p2 instanceof Point ? p1.y - p2.y : p1[1] - p2[1];
  return Math.sqrt(dx ** 2 + dy ** 2);
}
