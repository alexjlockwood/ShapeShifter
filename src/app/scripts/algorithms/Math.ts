import { toPathString } from './Svg';
import { Point } from './Types';

export function distance(a: Point, b: Point) {
  return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]));
}

export function pointAlong(a: Point, b: Point, pct: number) {
  return [a[0] + (b[0] - a[0]) * pct, a[1] + (b[1] - a[1]) * pct] as Point;
}

export function samePoint(a: Point, b: Point) {
  return distance(a, b) < 1e-9;
}

export function interpolatePoints(
  a: ReadonlyArray<Point>,
  b: ReadonlyArray<Point>,
  string: boolean,
) {
  const interpolators = a.map((d, i) => interpolatePoint(d, b[i]));
  return (t: number) => {
    const values = interpolators.map(fn => fn(t));
    return string ? toPathString(values) : values;
  };
}

export function interpolatePoint(a: Point, b: Point) {
  return (t: number) => {
    return a.map((d, i) => d + t * (b[i] - d)) as Point;
  };
}

export function isFiniteNumber(num: number) {
  return typeof num === 'number' && isFinite(num);
}
