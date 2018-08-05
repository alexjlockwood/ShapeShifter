import * as _ from 'lodash';

import { Matrix } from './Matrix';
import { Point } from './Point';

/** Returns the floor modulus of the integer argument. */
export function floorMod(num: number, maxNum: number) {
  return ((num % maxNum) + maxNum) % maxNum;
}

/** Linearly interpolate between a and b using time t. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Returns true if the points are collinear. */
export function areCollinear(...points: Point[]) {
  if (points.length < 3) {
    return true;
  }
  const { x: a, y: b } = points[0];
  const { x: m, y: n } = points[1];
  return points.every(({ x, y }) => {
    // The points are collinear if the area of the triangle they form
    // is equal to (or in this case, close to) zero.
    return Math.abs(a * (n - y) + m * (y - b) + x * (b - n)) < 1e-9;
  });
}

/** Applies a list of transformation matrices to the specified point. */
export function transformPoint(point: Point, ...matrices: Matrix[]) {
  return matrices.reduce((p: Point, m: Matrix) => {
    // [a c e]   [p.x]
    // [b d f] * [p.y]
    // [0 0 1]   [ 1 ]
    const x = round(m.a * p.x + m.c * p.y + m.e * 1);
    const y = round(m.b * p.x + m.d * p.y + m.f * 1);
    return { x, y };
  }, point);
}

/** Calculates the distance between two points. */
export function distance(p1: Point, p2: Point) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/** Returns true if the two points are equal. */
export function arePointsEqual(p1: Point, p2: Point) {
  return p1 && p2 && isNearZero(distance(p1, p2));
}

/** Rounds the number to a prespecified precision. */
export function round(n: number) {
  return _.round(n, 9);
}

/** Snaps a directional vector to the specified angle. */
export function snapVectorToAngle(delta: Point, snapAngleDegrees: number): Point {
  const snapAngle = (snapAngleDegrees * Math.PI) / 180;
  const angle = Math.round(Math.atan2(delta.y, delta.x) / snapAngle) * snapAngle;
  const dirx = Math.cos(angle);
  const diry = Math.sin(angle);
  const d = dirx * delta.x + diry * delta.y;
  return { x: dirx * d, y: diry * d };
}

/** Returns true iff the number is near 0. */
export function isNearZero(n: number) {
  return round(n) === 0;
}
