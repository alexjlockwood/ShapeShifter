import { polygonLength } from 'd3-polygon';

import { INVALID_INPUT_ALL } from './Errors';
import { distance, pointAlong } from './Math';
import { normalizeRing } from './Normalize';
import { pieceOrder } from './Order';
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
  const t0 = typeof fromShape === 'string' && fromShape;
  let t1: string[];

  if (!single || toShapes.every(s => typeof s === 'string')) {
    t1 = toShapes.slice();
  }

  return interpolateSets(fromRings, toRings, { match: true, string, single, t0, t1 });
}

export function combine(
  fromShapes: string[],
  toShape: string,
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  const interpolators = separate(toShape, fromShapes, { maxSegmentLength, string, single });
  return Array.isArray(interpolators)
    ? interpolators.map(fn => t => fn(1 - t))
    : (t: number) => interpolators(1 - t);
}

export function interpolateAll(
  fromShapes: ReadonlyArray<string>,
  toShapes: ReadonlyArray<string>,
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  if (fromShapes.length !== toShapes.length || !fromShapes.length) {
    throw new TypeError(INVALID_INPUT_ALL);
  }
  const normalizeFn = (s: string) => normalizeRing(s, maxSegmentLength);
  const fromRings = fromShapes.map(normalizeFn);
  const toRings = toShapes.map(normalizeFn);
  const t0 = fromShapes.slice();
  const t1 = toShapes.slice();
  return interpolateSets(fromRings, toRings, { string, single, t0, t1, match: false });
}

interface Options {
  string?: boolean;
  single?: boolean;
  t0?: string | ReadonlyArray<string>;
  t1?: string | ReadonlyArray<string>;
  match?: boolean;
}

function interpolateSets(
  fromRings: ReadonlyArray<Ring>,
  toRings: ReadonlyArray<Ring>,
  { string, single, t0, t1, match }: Options = {},
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

    if (string && (t0 || t1)) {
      return (t: number) =>
        ((t < 1e-4 && t0) || (1 - t < 1e-4 && t1) || multiInterpolator(t)) as string;
    }
    return multiInterpolator;
  } else if (string) {
    t0 = Array.isArray(t0) ? t0.map(d => typeof d === 'string' && d) : [];
    t1 = Array.isArray(t1) ? t1.map(d => typeof d === 'string' && d) : [];

    return interpolators.map((fn, i) => {
      if (t0[i] || t1[i]) {
        return (t: number) => ((t < 1e-4 && t0[i]) || (1 - t < 1e-4 && t1[i]) || fn(t)) as string;
      }
      return fn;
    });
  }

  return interpolators;
}

function interpolateRing(fromRing: Ring, toRing: Ring, string: boolean) {
  const diff = fromRing.length - toRing.length;

  // TODO bisect and add points in one step?
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
    const segment = distance(a, b);

    if (insertAt <= cursor + segment) {
      ring.splice(
        i + 1,
        0,
        segment ? pointAlong(a, b, (insertAt - cursor) / segment) : a.slice(0) as Point,
      );
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

    vs.forEach((p, i) => {
      const d = distance(ring[(offset + i) % len], p);
      sumOfSquares += d * d;
    });

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
