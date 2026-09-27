import { parseCommands } from 'app/modules/editor/model/paths/PathParser';
import type { Point } from 'app/modules/editor/scripts/common';
import { clamp, round } from 'lodash-es';

import * as BezierEasing from './BezierEasing';

/**
 * One cubic bezier of an easing curve, in the unit square's coordinates: x is the animation's
 * fraction of time, and y the fraction of the way from the start value to the end value.
 */
export interface CurveSegment {
  readonly start: Point;
  readonly cp1: Point;
  readonly cp2: Point;
  readonly end: Point;
}

/**
 * An easing curve: cubic beziers from (0, 0) to (1, 1), each starting where the one before it
 * ends, with anchor x values that strictly increase and control points within their segment's x
 * range, so that x only ever increases along it (which Android's PathInterpolator requires). The
 * y values may leave [0, 1], e.g. to overshoot.
 */
export type Curve = ReadonlyArray<CurveSegment>;

/** The most segments a curve may have. */
export const MAX_CURVE_SEGMENTS = 32;

/** The decimals a curve's numbers are written with. */
const CURVE_DECIMALS = 3;

// Anything else (e.g. a misspelled preset name, NaN, or Infinity) isn't path data, even though the
// path parser would skip it.
const PATH_DATA_CHARS = /^[\sMmLlHhVvCcSsQqTtAa\d.,+\-eE]*$/;

/**
 * Parses an easing curve written as Android pathInterpolator path data, e.g.
 * "M 0 0 C 0.4 0 0.2 1 1 1". It accepts a move to (0, 0), followed by lines, quadratic and cubic
 * beziers (and anything else the path parser turns into them, like arcs), which it converts to
 * cubics. Numbers are rounded to 3 decimals, and control points are moved into their segment's x
 * range. Returns undefined for anything that isn't a valid curve: a closed or second subpath,
 * endpoints other than (0, 0) and (1, 1), anchor x values that don't strictly increase, numbers
 * that aren't finite, or more than MAX_CURVE_SEGMENTS segments.
 */
export function parseCurve(value: unknown): Curve | undefined {
  if (typeof value !== 'string' || !PATH_DATA_CHARS.test(value)) {
    return undefined;
  }
  let commands: ReturnType<typeof parseCommands>;
  try {
    commands = parseCommands(value);
  } catch {
    return undefined;
  }
  if (commands.length < 2 || commands[0].type !== 'M') {
    return undefined;
  }
  const segments: CurveSegment[] = [];
  for (const command of commands.slice(1)) {
    const points = command.points;
    const start = points[0];
    const end = command.end;
    if (!start) {
      return undefined;
    }
    switch (command.type) {
      case 'L':
        segments.push(lineToCubic(start, end));
        break;
      case 'Q': {
        const cp = points[1];
        if (!cp) {
          return undefined;
        }
        segments.push(quadToCubic(start, cp, end));
        break;
      }
      case 'C': {
        const [, cp1, cp2] = points;
        if (!cp1 || !cp2) {
          return undefined;
        }
        segments.push({ start, cp1, cp2, end });
        break;
      }
      default:
        // A second M, or a Z.
        return undefined;
    }
  }
  return normalizeCurve(segments);
}

/**
 * Rounds a curve's numbers the way curveToString writes them and moves its control points into
 * their segment's x range. Returns undefined if the result isn't a valid curve (see parseCurve).
 */
export function normalizeCurve(curve: Curve): Curve | undefined {
  if (!curve.length || curve.length > MAX_CURVE_SEGMENTS) {
    return undefined;
  }
  const anchors = [curve[0].start, ...curve.map(s => s.end)].map(roundPoint);
  if (anchors.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return undefined;
  }
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first.x !== 0 || first.y !== 0 || last.x !== 1 || last.y !== 1) {
    return undefined;
  }
  const segments: CurveSegment[] = [];
  for (let i = 0; i < curve.length; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];
    if (!(start.x < end.x)) {
      return undefined;
    }
    // Segments that don't join up (from a caller building one by hand) join at the rounded end of
    // the one before.
    const cp1 = roundPoint(curve[i].cp1);
    const cp2 = roundPoint(curve[i].cp2);
    if (![cp1.x, cp1.y, cp2.x, cp2.y].every(Number.isFinite)) {
      return undefined;
    }
    segments.push({
      start,
      cp1: { x: clamp(cp1.x, start.x, end.x), y: cp1.y },
      cp2: { x: clamp(cp2.x, start.x, end.x), y: cp2.y },
      end,
    });
  }
  return segments;
}

/**
 * Writes a curve as canonical Android pathInterpolator path data: an M, then an absolute C per
 * segment, with numbers rounded to 3 decimals. parseCurve reads it back as the same curve.
 */
export function curveToString(curve: Curve) {
  if (!curve.length) {
    return 'M 0 0';
  }
  const parts = [`M ${formatCurveNumber(curve[0].start.x)} ${formatCurveNumber(curve[0].start.y)}`];
  for (const { cp1, cp2, end } of curve) {
    const numbers = [cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y].map(formatCurveNumber);
    parts.push(`C ${numbers.join(' ')}`);
  }
  return parts.join(' ');
}

/**
 * Returns the easing function for a valid curve (see parseCurve): it finds the segment that holds
 * the fraction, solves that segment's x(t) for it, and returns y(t).
 */
export function createCurveEasing(curve: Curve): (fraction: number) => number {
  const solvers = curve.map(({ start, cp1, cp2, end }) => {
    const width = end.x - start.x;
    const getTForX = BezierEasing.createTForX(
      clamp((cp1.x - start.x) / width, 0, 1),
      clamp((cp2.x - start.x) / width, 0, 1),
    );
    return (x: number) => getTForX((x - start.x) / width);
  });
  const last = curve.length - 1;
  return (fraction: number) => {
    if (fraction <= 0) {
      return curve[0].start.y;
    }
    if (fraction >= 1) {
      return curve[last].end.y;
    }
    // Curves have few segments, so a linear search is as fast as a binary one.
    let i = 0;
    while (i < last && fraction >= curve[i].end.x) {
      i++;
    }
    const { start, cp1, cp2, end } = curve[i];
    return bezierAt(solvers[i](fraction), start.y, cp1.y, cp2.y, end.y);
  };
}

/** Returns the point at t on a segment. */
export function pointAt({ start, cp1, cp2, end }: CurveSegment, t: number): Point {
  return {
    x: bezierAt(t, start.x, cp1.x, cp2.x, end.x),
    y: bezierAt(t, start.y, cp1.y, cp2.y, end.y),
  };
}

/** Evaluates a cubic bezier's coordinate at t from its Bernstein form. */
function bezierAt(t: number, p0: number, p1: number, p2: number, p3: number) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

function lineToCubic(start: Point, end: Point): CurveSegment {
  return {
    start,
    cp1: { x: start.x + (end.x - start.x) / 3, y: start.y + (end.y - start.y) / 3 },
    cp2: { x: start.x + ((end.x - start.x) * 2) / 3, y: start.y + ((end.y - start.y) * 2) / 3 },
    end,
  };
}

function quadToCubic(start: Point, cp: Point, end: Point): CurveSegment {
  return {
    start,
    cp1: { x: start.x + ((cp.x - start.x) * 2) / 3, y: start.y + ((cp.y - start.y) * 2) / 3 },
    cp2: { x: end.x + ((cp.x - end.x) * 2) / 3, y: end.y + ((cp.y - end.y) * 2) / 3 },
    end,
  };
}

function roundPoint(p: Point): Point {
  return { x: roundNumber(p.x), y: roundNumber(p.y) };
}

function roundNumber(n: number) {
  // Adding 0 turns -0 into 0.
  return round(n, CURVE_DECIMALS) + 0;
}

/** Formats a number like curveToString does, e.g. for an AVD attribute. */
export function formatCurveNumber(n: number) {
  return String(roundNumber(n));
}
