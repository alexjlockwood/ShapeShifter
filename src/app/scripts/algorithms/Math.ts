import { toPathString } from './Svg';
import { Point } from './Types';

export function distance(a: Point, b: Point) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function pointAlong(a: Point, b: Point, pct: number) {
  return [a[0] + (b[0] - a[0]) * pct, a[1] + (b[1] - a[1]) * pct] as Point;
}

export function isFiniteNumber(num: number) {
  return typeof num === 'number' && isFinite(num);
}
