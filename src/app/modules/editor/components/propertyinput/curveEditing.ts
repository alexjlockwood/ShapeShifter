import {
  type Curve,
  type CurveSegment,
  MAX_CURVE_SEGMENTS,
  normalizeCurve,
  pointAt,
} from 'app/modules/editor/model/interpolators';
import type { Point } from 'app/modules/editor/scripts/common';
import { clamp } from 'lodash-es';

/** How far the curve editor lets a point go below 0 and above 1, to anticipate or overshoot. */
export const CURVE_MIN_Y = -1;
export const CURVE_MAX_Y = 2;

/**
 * The least distance between two anchors' x values. It's well above the 3 decimals curves are
 * written with, so rounding never makes two anchors meet.
 */
export const MIN_ANCHOR_GAP = 0.01;

/**
 * A handle the curve editor can drag: an anchor between two segments (never the ends, which stay
 * at (0, 0) and (1, 1)), or one of a segment's control points.
 */
export type CurveHandle =
  | { readonly type: 'anchor'; readonly index: number }
  | { readonly type: 'control'; readonly segment: number; readonly which: 'cp1' | 'cp2' };

/** Returns the curve's anchors: (0, 0), where each segment ends, and (1, 1). */
export function getAnchors(curve: Curve): Point[] {
  return curve.length ? [curve[0].start, ...curve.map(s => s.end)] : [];
}

/** Returns whether the anchor at the index can move or be removed (i.e. isn't an end). */
export function isInteriorAnchor(curve: Curve, index: number) {
  return Number.isInteger(index) && index > 0 && index < curve.length;
}

/** Returns where a handle is. */
export function getHandlePoint(curve: Curve, handle: CurveHandle): Point | undefined {
  if (handle.type === 'anchor') {
    return getAnchors(curve)[handle.index];
  }
  return curve[handle.segment]?.[handle.which];
}

/**
 * Returns the curve with a handle moved as close to the point as the curve allows:
 * - An anchor stays at least MIN_ANCHOR_GAP from its neighbors' x values, and its control points
 *   move with it.
 * - A control point stays within its segment's x range.
 * - Both stay within CURVE_MIN_Y and CURVE_MAX_Y.
 * Returns the curve unchanged if the handle doesn't exist or can't move.
 */
export function moveHandle(curve: Curve, handle: CurveHandle, to: Point): Curve {
  const segments = curve.map(s => ({ ...s }));
  const y = clamp(to.y, CURVE_MIN_Y, CURVE_MAX_Y);
  if (handle.type === 'control') {
    const segment = segments[handle.segment];
    if (!segment) {
      return curve;
    }
    segment[handle.which] = { x: clamp(to.x, segment.start.x, segment.end.x), y };
  } else {
    const i = handle.index;
    if (!isInteriorAnchor(curve, i)) {
      return curve;
    }
    const before = segments[i - 1];
    const after = segments[i];
    const minX = before.start.x + MIN_ANCHOR_GAP;
    const maxX = after.end.x - MIN_ANCHOR_GAP;
    if (minX > maxX) {
      return curve;
    }
    const anchor = { x: clamp(to.x, minX, maxX), y };
    const dx = anchor.x - after.start.x;
    const dy = anchor.y - after.start.y;
    const moveControl = (p: Point) => ({
      x: p.x + dx,
      y: clamp(p.y + dy, CURVE_MIN_Y, CURVE_MAX_Y),
    });
    // normalizeCurve moves the control points back into their segments' x ranges.
    before.cp2 = moveControl(before.cp2);
    before.end = anchor;
    after.cp1 = moveControl(after.cp1);
    after.start = anchor;
  }
  return normalizeCurve(segments) ?? curve;
}

/**
 * Splits a segment in two at t (de Casteljau), which leaves the curve's shape as it was. Returns
 * undefined if the curve already has MAX_CURVE_SEGMENTS segments, or if the new anchor would be
 * closer than MIN_ANCHOR_GAP to its neighbors.
 */
export function splitSegment(curve: Curve, index: number, t: number): Curve | undefined {
  const segment = curve[index];
  if (!segment || curve.length >= MAX_CURVE_SEGMENTS || !(t > 0 && t < 1)) {
    return undefined;
  }
  const [left, right] = splitAt(segment, t);
  if (left.end.x - left.start.x < MIN_ANCHOR_GAP || right.end.x - right.start.x < MIN_ANCHOR_GAP) {
    return undefined;
  }
  return normalizeCurve([...curve.slice(0, index), left, right, ...curve.slice(index + 1)]);
}

/**
 * Removes an anchor between two segments, joining them into one. The joined segment's control
 * points are its neighbors' outer ones, lengthened as if the anchor had been added by
 * splitSegment, so removing an anchor that was just added gives back about the same curve.
 * Returns undefined for the ends, which can't be removed.
 */
export function removeAnchor(curve: Curve, index: number): Curve | undefined {
  if (!isInteriorAnchor(curve, index)) {
    return undefined;
  }
  const before = curve[index - 1];
  const after = curve[index];
  const start = before.start;
  const end = after.end;
  // Where the anchor would be along the joined segment. Splitting at t leaves the anchor's
  // handles in the ratio t : (1 - t), so this is exact for an anchor that splitSegment added.
  // Without handles, it's estimated from the anchor's x.
  const inLength = Math.hypot(before.end.x - before.cp2.x, before.end.y - before.cp2.y);
  const outLength = Math.hypot(after.cp1.x - after.start.x, after.cp1.y - after.start.y);
  const t = clamp(
    inLength + outLength > 0
      ? inLength / (inLength + outLength)
      : (before.end.x - start.x) / (end.x - start.x),
    0.05,
    0.95,
  );
  const lengthen = (from: Point, p: Point, scale: number) => ({
    x: from.x + (p.x - from.x) * scale,
    y: clamp(from.y + (p.y - from.y) * scale, CURVE_MIN_Y, CURVE_MAX_Y),
  });
  const joined: CurveSegment = {
    start,
    cp1: lengthen(start, before.cp1, 1 / t),
    cp2: lengthen(end, after.cp2, 1 / (1 - t)),
    end,
  };
  return normalizeCurve([...curve.slice(0, index - 1), joined, ...curve.slice(index + 1)]);
}

/**
 * Returns the point on the curve nearest to a point, measured after mapping both with toView
 * (e.g. into the graph's pixels, whose x and y scales differ).
 */
export function findNearestPoint(
  curve: Curve,
  target: Point,
  toView: (p: Point) => Point = p => p,
): { readonly segment: number; readonly t: number; readonly distance: number } | undefined {
  if (!curve.length) {
    return undefined;
  }
  const view = toView(target);
  const SAMPLES = 64;
  const measure = (segment: number, t: number) => {
    const p = toView(pointAt(curve[segment], t));
    return Math.hypot(p.x - view.x, p.y - view.y);
  };
  let segment = 0;
  let t = 0;
  let distance = Infinity;
  for (let s = 0; s < curve.length; s++) {
    for (let i = 0; i <= SAMPLES; i++) {
      const d = measure(s, i / SAMPLES);
      if (d < distance) {
        segment = s;
        t = i / SAMPLES;
        distance = d;
      }
    }
  }
  // Refines the nearest sample by halving the step around it.
  let step = 1 / SAMPLES;
  for (let i = 0; i < 10; i++) {
    step /= 2;
    const center = t;
    for (const candidate of [center - step, center + step]) {
      if (candidate >= 0 && candidate <= 1) {
        const d = measure(segment, candidate);
        if (d < distance) {
          t = candidate;
          distance = d;
        }
      }
    }
  }
  return { segment, t, distance };
}

/**
 * Returns the range of y values the graph shows for a curve: [0, 1], grown to hold every anchor
 * and control point.
 */
export function getCurveYRange(curve: Curve): { readonly min: number; readonly max: number } {
  let min = 0;
  let max = 1;
  for (const { cp1, cp2, end } of curve) {
    for (const { y } of [cp1, cp2, end]) {
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }
  return { min, max };
}

function splitAt({ start, cp1, cp2, end }: CurveSegment, t: number): [CurveSegment, CurveSegment] {
  const lerp = (a: Point, b: Point) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const p01 = lerp(start, cp1);
  const p12 = lerp(cp1, cp2);
  const p23 = lerp(cp2, end);
  const p012 = lerp(p01, p12);
  const p123 = lerp(p12, p23);
  const mid = lerp(p012, p123);
  return [
    { start, cp1: p01, cp2: p012, end: mid },
    { start: mid, cp1: p123, cp2: p23, end },
  ];
}
