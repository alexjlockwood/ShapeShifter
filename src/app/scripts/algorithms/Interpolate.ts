import { addPoints } from './Add';
import { interpolatePoints } from './Math';
import { normalizeRing } from './Normalize';
import { rotate } from './Rotate';
import { Ring } from './Types';

export function interpolate(
  fromShape: string | Ring,
  toShape: string | Ring,
  { maxSegmentLength = 10, string = true } = {},
) {
  const fromRing = normalizeRing(fromShape, maxSegmentLength);
  const toRing = normalizeRing(toShape, maxSegmentLength);
  const interpolator = interpolateRing(fromRing, toRing, string);

  // Extra optimization for near either end with path strings
  if (!string || (typeof fromShape !== 'string' && typeof toShape !== 'string')) {
    return interpolator;
  }

  return (t: number) => {
    if (t < 1e-4 && typeof fromShape === 'string') {
      return fromShape;
    }
    if (1 - t < 1e-4 && typeof toShape === 'string') {
      return toShape;
    }
    return interpolator(t);
  };
}

export function interpolateRing(fromRing: Ring, toRing: Ring, string: boolean) {
  const diff = fromRing.length - toRing.length;

  // TODO bisect and add points in one step?
  addPoints(fromRing, diff < 0 ? diff * -1 : 0);
  addPoints(toRing, diff > 0 ? diff : 0);

  rotate(fromRing, toRing);

  return interpolatePoints(fromRing, toRing, string);
}
