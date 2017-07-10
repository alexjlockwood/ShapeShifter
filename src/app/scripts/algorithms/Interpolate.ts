import { addPoints } from './Add';
import { interpolatePoints } from './Math';
import { normalizeRing } from './Normalize';
import { rotate } from './Rotate';

export function interpolate(fromShape, toShape, { maxSegmentLength = 10, string = true } = {}) {
  let fromRing = normalizeRing(fromShape, maxSegmentLength),
    toRing = normalizeRing(toShape, maxSegmentLength),
    interpolator = interpolateRing(fromRing, toRing, string);

  // Extra optimization for near either end with path strings
  if (!string || (typeof fromShape !== 'string' && typeof toShape !== 'string')) {
    return interpolator;
  }

  return t => {
    if (t < 1e-4 && typeof fromShape === 'string') {
      return fromShape;
    }
    if (1 - t < 1e-4 && typeof toShape === 'string') {
      return toShape;
    }
    return interpolator(t);
  };
}

export function interpolateRing(fromRing, toRing, string) {
  let diff;

  diff = fromRing.length - toRing.length;

  // TODO bisect and add points in one step?
  addPoints(fromRing, diff < 0 ? diff * -1 : 0);
  addPoints(toRing, diff > 0 ? diff : 0);

  rotate(fromRing, toRing);

  return interpolatePoints(fromRing, toRing, string);
}
