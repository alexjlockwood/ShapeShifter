import { MathUtil } from 'app/scripts/common';
import { polygonLength } from 'd3-polygon';
import { polygonCentroid } from 'd3-polygon';
import { polygonArea } from 'd3-polygon';
import * as _ from 'lodash';

import { toPathString } from './Svg';
import { pathStringToRing } from './Svg';
import { triangulate } from './Triangulate';
import { Point, Ring } from './Types';

export function separate(
  fromShape: string,
  toShapes: ReadonlyArray<string>,
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  const fromRing = normalizeRing(fromShape, maxSegmentLength);
  if (fromRing.length < toShapes.length + 2) {
    addPoints(fromRing, toShapes.length + 2 - fromRing.length);
  }
  const fromRings = triangulate(fromRing, toShapes.length);
  const toRings = toShapes.map(d => normalizeRing(d, maxSegmentLength));
  return interpolateSets(fromRings, toRings, {
    match: true,
    string,
    single,
    t0: fromShape,
    t1: [...toShapes],
  });
}

export function combine(
  fromShapes: ReadonlyArray<string>,
  toShape: string,
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  const interps = separate(toShape, fromShapes, { maxSegmentLength, string, single });
  return Array.isArray(interps) ? interps.map(fn => t => fn(1 - t)) : (t: number) => interps(1 - t);
}

export function interpolateAll(
  fromShapes: ReadonlyArray<string>,
  toShapes: ReadonlyArray<string>,
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  if (fromShapes.length !== toShapes.length || !fromShapes.length) {
    throw new TypeError('Unequal number of shapes');
  }
  const normalizeFn = (s: string) => normalizeRing(s, maxSegmentLength);
  const fromRings = fromShapes.map(normalizeFn);
  const toRings = toShapes.map(normalizeFn);
  return interpolateSets(fromRings, toRings, {
    string,
    single,
    t0: [...fromShapes],
    t1: [...toShapes],
    match: false,
  });
}

interface InterpolateOptions {
  string: boolean;
  single: boolean;
  t0: string | ReadonlyArray<string>;
  t1: string | ReadonlyArray<string>;
  match: boolean;
}

function interpolateSets(
  fromRings: ReadonlyArray<Ring>,
  toRings: ReadonlyArray<Ring>,
  { string, single, t0, t1, match }: InterpolateOptions,
) {
  const order = match ? pieceOrder(fromRings, toRings) : fromRings.map((d, i) => i);
  const interpolators = order.map((d, i) => interpolateRing(fromRings[d], toRings[i], string));
  if (match && Array.isArray(t0)) {
    t0 = order.map(d => t0[d]);
  }
  if (single && string) {
    if (Array.isArray(t0)) {
      t0 = t0.join(' ');
    }
    if (Array.isArray(t1)) {
      t1 = t1.join(' ');
    }
  }
  if (single) {
    const multiInterpolator = string
      ? (t: number) => interpolators.map(fn => fn(t)).join(' ')
      : (t: number) => interpolators.map(fn => fn(t));
    return string && (t0 || t1) ? (t: number) => multiInterpolator(t) as string : multiInterpolator;
  }
  if (string) {
    t0 = Array.isArray(t0) ? t0.map(d => typeof d === 'string' && d) : [];
    t1 = Array.isArray(t1) ? t1.map(d => typeof d === 'string' && d) : [];
    return interpolators.map((fn, i) => (t0[i] || t1[i] ? (t: number) => fn(t) as string : fn));
  }
  return interpolators;
}

function pieceOrder(start: ReadonlyArray<Ring>, end: ReadonlyArray<Ring>) {
  const squaredDistanceFn = (p1: Ring, p2: Ring) =>
    MathUtil.distance(polygonCentroid(p1), polygonCentroid(p2)) ** 2;
  return start.length > 8
    ? start.map((d, i) => i)
    : bestOrder(start, end, start.map(p1 => end.map(p2 => squaredDistanceFn(p1, p2))));
}

function bestOrder(
  start: ReadonlyArray<Ring>,
  end: ReadonlyArray<Ring>,
  distances: ReadonlyTable<number>,
) {
  let min = Infinity;
  let best = start.map((d, i) => i);
  (function permute(arr: number[], order: ReadonlyArray<number> = [], sum = 0) {
    for (let i = 0; i < arr.length; i++) {
      const cur = arr.splice(i, 1);
      const dist = distances[cur[0]][order.length];
      if (sum + dist < min) {
        if (arr.length) {
          permute([...arr], [...order, ...cur], sum + dist);
        } else {
          min = sum + dist;
          best = [...order, ...cur];
        }
      }
      if (arr.length) {
        arr.splice(i, 0, cur[0]);
      }
    }
  })(best);
  return best as ReadonlyArray<number>;
}

function interpolateRing(fromRing: Ring, toRing: Ring, string: boolean) {
  const diff = fromRing.length - toRing.length;
  // TODO: this could be more efficient if we added and split segments in the same step
  addPoints(fromRing, diff < 0 ? diff * -1 : 0);
  addPoints(toRing, diff > 0 ? diff : 0);
  rotate(fromRing, toRing);
  const interpolators = fromRing.map((fromPoint, index) => {
    const toPoint = toRing[index];
    return (t: number) => fromPoint.map((d, i) => d + t * (toPoint[i] - d)) as Point;
  });
  return (t: number) => {
    const values = interpolators.map(fn => fn(t));
    return string ? toPathString(values) : values;
  };
}

/**
 * Adds the specified number of dummy points to the provided ring.
 */
function addPoints(ring: Ring, numPoints: number) {
  const desiredLength = ring.length + numPoints;
  const step = polygonLength(ring) / numPoints;
  let i = 0;
  let cursor = 0;
  let insertAt = step / 2;
  while (ring.length < desiredLength) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const segment = MathUtil.distance(a, b);
    if (insertAt <= cursor + segment) {
      const p = segment ? MathUtil.lerp(a, b, (insertAt - cursor) / segment) : [...a] as Point;
      ring.splice(i + 1, 0, p);
      insertAt += step;
      continue;
    }
    cursor += segment;
    i++;
  }
}

function rotate(ring: Ring, vs: Ring) {
  const len = ring.length;
  let min = Infinity;
  let bestOffset: number;
  let spliced: Point[];
  for (let offset = 0; offset < len; offset++) {
    let sumOfSquares = 0;
    vs.forEach((p, i) => (sumOfSquares += MathUtil.distance(ring[(offset + i) % len], p) ** 2));
    if (sumOfSquares < min) {
      min = sumOfSquares;
      bestOffset = offset;
    }
  }
  if (bestOffset) {
    spliced = ring.splice(0, bestOffset);
    ring.splice(ring.length, 0, ...spliced);
  }
}

function normalizeRing(pathStr: string, maxSegmentLength: number) {
  const { ring, skipSplit } = pathStringToRing(pathStr, maxSegmentLength);
  const points = [...ring];
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
  if (!skipSplit && maxSegmentLength && _.isFinite(maxSegmentLength) && maxSegmentLength > 0) {
    splitRing(points, maxSegmentLength);
  }
  return points;
}

/**
 * Iterates through a ring, splitting any segment that exceeds maxSegmentLength.
 */
function splitRing(ring: Ring, maxSegmentLength = Infinity) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    let b = i === ring.length - 1 ? ring[0] : ring[i + 1];
    while (MathUtil.distance(a, b) > maxSegmentLength) {
      b = MathUtil.lerp(a, b, 0.5);
      ring.splice(i + 1, 0, b);
    }
  }
}
