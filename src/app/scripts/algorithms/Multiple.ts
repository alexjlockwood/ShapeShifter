import { addPoints } from './Add';
import { INVALID_INPUT_ALL } from './Errors';
import { interpolateRing } from './Interpolate';
import { normalizeRing } from './Normalize';
import { pieceOrder } from './Order';
import { toPathString } from './Svg';
import { triangulate } from './Triangulate';
import { Ring } from './Types';

export function separate(
  fromShape: string,
  toShapes: string[],
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
    t1 = toShapes.slice(0);
  }

  return interpolateSets(fromRings, toRings, { match: true, string, single, t0, t1 });
}

// export function combine(
//   fromShapes: string[],
//   toShape: string,
//   { maxSegmentLength = 10, string = true, single = false } = {},
// ) {
//   const interpolators = separate(toShape, fromShapes, { maxSegmentLength, string, single });
//   return single ? (t: number) => interpolators(1 - t) : interpolators.map(fn => t => fn(1 - t));
// }

export function interpolateAll(
  fromShapes: string[],
  toShapes: string[],
  { maxSegmentLength = 10, string = true, single = false } = {},
) {
  if (
    !Array.isArray(fromShapes) ||
    !Array.isArray(toShapes) ||
    fromShapes.length !== toShapes.length ||
    !fromShapes.length
  ) {
    throw new TypeError(INVALID_INPUT_ALL);
  }

  const normalize = (s: string) => normalizeRing(s, maxSegmentLength);
  const fromRings = fromShapes.map(normalize);
  const toRings = toShapes.map(normalize);
  let t0;
  let t1;

  if (single) {
    if (fromShapes.every(s => typeof s === 'string')) {
      t0 = fromShapes.slice(0);
    }
    if (toShapes.every(s => typeof s === 'string')) {
      t1 = toShapes.slice(0);
    }
  } else {
    t0 = fromShapes.slice(0);
    t1 = toShapes.slice(0);
  }

  return interpolateSets(fromRings, toRings, { string, single, t0, t1, match: false });
}

function interpolateSets(
  fromRings: Ring[],
  toRings: Ring[],
  { string, single, t0, t1, match }: any = {},
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
      ? t => interpolators.map(fn => fn(t)).join(' ')
      : t => interpolators.map(fn => fn(t));

    if (string && (t0 || t1)) {
      return t => (t < 1e-4 && t0) || (1 - t < 1e-4 && t1) || multiInterpolator(t);
    }
    return multiInterpolator;
  } else if (string) {
    t0 = Array.isArray(t0) ? t0.map(d => typeof d === 'string' && d) : [];
    t1 = Array.isArray(t1) ? t1.map(d => typeof d === 'string' && d) : [];

    return interpolators.map((fn, i) => {
      if (t0[i] || t1[i]) {
        return t => (t < 1e-4 && t0[i]) || (1 - t < 1e-4 && t1[i]) || fn(t);
      }
      return fn;
    });
  }

  return interpolators;
}
