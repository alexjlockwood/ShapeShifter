import { Matrix, Point } from '.';

const EPSILON = 1e-8;

/** Returns the floor modulus of the integer argument. */
export function floorMod(num: number, maxNum: number) {
  return ((num % maxNum) + maxNum) % maxNum;
}

/** Linearly interpolate between point a and point b using time t. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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
    return new Point(
      m.a * p.x + m.c * p.y + m.e * 1,
      m.b * p.x + m.d * p.y + m.f * 1,
    );
  }, new Point(point.x, point.y));
}

/** Calculates the distance between two points. */
export function distance(p1: Point, p2: Point) {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/** Flattens the transformation matrices into a single matrix. */
export function flattenTransforms(matricies: Matrix[]) {
  return matricies.reduce((prev, curr) => curr.dot(prev), new Matrix());
}
