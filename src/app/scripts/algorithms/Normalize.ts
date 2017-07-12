import { MathUtil } from 'app/scripts/common';
import { polygonArea } from 'd3-polygon';
import * as _ from 'lodash-es';

import { pathStringToRing } from './Svg';
import { Point, Ring } from './Types';

export function normalizeRing(ring: string | Ring, maxSegmentLength: number) {
  let skipBisect = false;
  if (typeof ring === 'string') {
    const converted = pathStringToRing(ring, maxSegmentLength);
    ring = converted.ring;
    skipBisect = converted.skipBisect;
  }
  const points = [...ring] as Ring;
  if (!validRing(points)) {
    throw new TypeError(
      'All shapes must be supplied as arrays of [x, y] points or an SVG path string',
    );
  }
  const samePointFn = (a: Point, b: Point) => MathUtil.distance(a, b) < 1e-9;
  if (points.length > 1 && samePointFn(points[0], points[points.length - 1])) {
    points.pop();
  }
  if (points.length < 3) {
    throw new TypeError('Polygons must have at least three points');
  }
  const area = polygonArea(points);
  if (area > 0) {
    // Make all rings clockwise.
    points.reverse();
  }
  if (!skipBisect && maxSegmentLength && _.isFinite(maxSegmentLength) && maxSegmentLength > 0) {
    bisect(points, maxSegmentLength);
  }
  return points;
}

function validRing(ring: Ring) {
  return ring.every(p => Array.isArray(p) && p.length >= 2 && _.isFinite(p[0]) && _.isFinite(p[1]));
}

function bisect(ring: Ring, maxSegmentLength = Infinity) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    let b = i === ring.length - 1 ? ring[0] : ring[i + 1];
    while (MathUtil.distance(a, b) > maxSegmentLength) {
      b = MathUtil.lerp(a, b, 0.5);
      ring.splice(i + 1, 0, b);
    }
  }
}
