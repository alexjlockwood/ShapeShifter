import { Rect } from 'app/modules/editor/scripts/common';

/**
 * A distance to show while Alt is held: a horizontal line at y = at from x = from to x = to (axis
 * 'x'), or a vertical one at x = at. Where the line runs past the end of the target, a dashed line
 * along the target's edge shows where it's measured to.
 */
export interface Measurement {
  readonly axis: 'x' | 'y';
  readonly from: number;
  readonly to: number;
  readonly at: number;
  /** The dashed line along the target's edge (at = where it is along the axis), across to it. */
  readonly extension?: { readonly at: number; readonly from: number; readonly to: number };
}

/**
 * Returns the distances between the selection's bounds and a target's, like Figma does while Alt
 * is held: the gaps between them when they're apart, or how far each edge is inside of the other
 * box when they overlap, e.g. to the artboard's edges. Boxes side by side only show the gap
 * between them.
 */
export function getMeasurements(selection: Rect, target: Rect): Measurement[] {
  const isApartOnX = selection.r <= target.l || target.r <= selection.l;
  const isApartOnY = selection.b <= target.t || target.b <= selection.t;
  return [
    ...(isApartOnX || !isApartOnY ? measureAxis(selection, target, 'x') : []),
    ...(isApartOnY || !isApartOnX ? measureAxis(selection, target, 'y') : []),
  ];
}

function measureAxis(selection: Rect, target: Rect, axis: 'x' | 'y'): Measurement[] {
  // Along the axis (start and end), and across it (from and to).
  const span = (rect: Rect) =>
    axis === 'x'
      ? { start: rect.l, end: rect.r, from: rect.t, to: rect.b }
      : { start: rect.t, end: rect.b, from: rect.l, to: rect.r };
  const s = span(selection);
  const t = span(target);
  // Across the middle of where they overlap, or else the selection's middle.
  const overlapFrom = Math.max(s.from, t.from);
  const overlapTo = Math.min(s.to, t.to);
  const at = overlapFrom <= overlapTo ? (overlapFrom + overlapTo) / 2 : (s.from + s.to) / 2;
  // A dashed line along the target's edge, if the measurement misses the target.
  const across =
    at < t.from ? { from: at, to: t.from } : at > t.to ? { from: t.to, to: at } : undefined;
  const measure = (a: number, b: number, targetEdge: number): Measurement | undefined => {
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    if (to - from < 1e-9) {
      return undefined;
    }
    return { axis, from, to, at, ...(across ? { extension: { at: targetEdge, ...across } } : {}) };
  };
  let measurements: Array<Measurement | undefined>;
  if (s.end <= t.start) {
    measurements = [measure(s.end, t.start, t.start)];
  } else if (t.end <= s.start) {
    measurements = [measure(t.end, s.start, t.end)];
  } else {
    // They overlap along the axis, so it's from each edge to the other box's matching edge.
    measurements = [measure(s.start, t.start, t.start), measure(s.end, t.end, t.end)];
  }
  return measurements.filter((m): m is Measurement => !!m);
}
