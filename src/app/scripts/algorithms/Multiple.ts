import { MathUtil } from 'app/scripts/common';
import { polygonLength } from 'd3-polygon';
import { polygonCentroid } from 'd3-polygon';

import { normalizeRing } from './Normalize';
import { toPathString } from './Svg';
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

export function pieceOrder(start: ReadonlyArray<Ring>, end: ReadonlyArray<Ring>) {
  const squaredDistanceFn = (p1: Ring, p2: Ring) =>
    MathUtil.distance(polygonCentroid(p1), polygonCentroid(p2)) ** 2;
  const distances = start.map(p1 => end.map(p2 => squaredDistanceFn(p1, p2)));
  const order = bestOrder(start, end, distances);
  return start.length > 8 ? start.map((d, i) => i) : bestOrder(start, end, distances);
}

function bestOrder(
  start: ReadonlyArray<Ring>,
  end: ReadonlyArray<Ring>,
  distances: ReadonlyArray<ReadonlyArray<number>>,
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
  addPoints(fromRing, diff < 0 ? diff * -1 : 0);
  addPoints(toRing, diff > 0 ? diff : 0);
  rotate(fromRing, toRing);
  return interpolatePoints(fromRing, toRing, string);
}

function addPoints(ring: Ring, numPoints: number, maxLength = Infinity) {
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

function interpolatePoints(a: ReadonlyArray<Point>, b: ReadonlyArray<Point>, string: boolean) {
  const interpolators = a.map((d, i) => interpolatePoint(d, b[i]));
  return (t: number) => {
    const values = interpolators.map(fn => fn(t));
    return string ? toPathString(values) : values;
  };
}

function interpolatePoint(a: Point, b: Point) {
  return (t: number) => a.map((d, i) => d + t * (b[i] - d)) as Point;
}
