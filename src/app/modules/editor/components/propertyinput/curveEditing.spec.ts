import {
  createCurveEasing,
  type Curve,
  curveToString,
  MAX_CURVE_SEGMENTS,
  parseCurve,
  PRESET_CURVES,
} from 'app/modules/editor/model/interpolators';
import { range } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import {
  CURVE_MAX_Y,
  CURVE_MIN_Y,
  findNearestPoint,
  getAnchors,
  getCurveYRange,
  getHandlePoint,
  isInteriorAnchor,
  MIN_ANCHOR_GAP,
  moveHandle,
  removeAnchor,
  splitSegment,
} from './curveEditing';

function parse(value: string) {
  const curve = parseCurve(value);
  if (!curve) {
    throw new Error(`${value} isn't a curve`);
  }
  return curve;
}

const ONE = parse('M 0 0 C 0.4 0 0.2 1 1 1');
const TWO = parse('M 0 0 C 0.1 0 0.2 0.4 0.5 0.6 C 0.7 0.8 0.9 1 1 1');

describe('moveHandle', () => {
  it('moves a control point', () => {
    const moved = moveHandle(
      ONE,
      { type: 'control', segment: 0, which: 'cp1' },
      { x: 0.3, y: 0.2 },
    );
    expect(curveToString(moved)).toBe('M 0 0 C 0.3 0.2 0.2 1 1 1');
  });

  it("keeps a control point within its segment's x range, and y within the limits", () => {
    const moved = moveHandle(TWO, { type: 'control', segment: 1, which: 'cp1' }, { x: 0.1, y: 9 });
    expect(moved[1].cp1).toEqual({ x: 0.5, y: CURVE_MAX_Y });
    const low = moveHandle(TWO, { type: 'control', segment: 0, which: 'cp2' }, { x: 2, y: -9 });
    expect(low[0].cp2).toEqual({ x: 0.5, y: CURVE_MIN_Y });
  });

  it('moves an anchor with its control points', () => {
    const moved = moveHandle(TWO, { type: 'anchor', index: 1 }, { x: 0.6, y: 0.5 });
    expect(curveToString(moved)).toBe('M 0 0 C 0.1 0 0.3 0.3 0.6 0.5 C 0.8 0.7 0.9 1 1 1');
  });

  it('keeps an anchor away from its neighbors', () => {
    const moved = moveHandle(TWO, { type: 'anchor', index: 1 }, { x: 1.5, y: 0.5 });
    expect(getAnchors(moved)[1].x).toBe(1 - MIN_ANCHOR_GAP);
    // Its control point is moved back into the shrunken segment.
    expect(moved[1].cp1.x).toBeLessThanOrEqual(moved[1].end.x);
    expect(parseCurve(curveToString(moved))).toEqual(moved);
  });

  it("doesn't move the ends, or handles that don't exist", () => {
    expect(moveHandle(ONE, { type: 'anchor', index: 0 }, { x: 0.5, y: 0.5 })).toBe(ONE);
    expect(moveHandle(ONE, { type: 'anchor', index: 1 }, { x: 0.5, y: 0.5 })).toBe(ONE);
    expect(moveHandle(ONE, { type: 'control', segment: 3, which: 'cp1' }, { x: 0, y: 0 })).toBe(
      ONE,
    );
  });

  it('turns a preset into a valid custom curve', () => {
    const moved = moveHandle(
      PRESET_CURVES.ACCELERATE,
      { type: 'control', segment: 0, which: 'cp2' },
      { x: 0.7, y: 0.2 },
    );
    expect(curveToString(moved)).toBe('M 0 0 C 0.333 0 0.7 0.2 1 1');
  });
});

describe('splitSegment', () => {
  it('adds an anchor without changing the shape', () => {
    const split = splitSegment(ONE, 0, 0.5);
    expect(split).toHaveLength(2);
    const before = createCurveEasing(ONE);
    const after = createCurveEasing(split!);
    for (const f of range(0, 1.0001, 0.05)) {
      // Within the rounding to 3 decimals.
      expect(Math.abs(after(f) - before(f))).toBeLessThan(5e-3);
    }
  });

  it('refuses to add an anchor too close to another, or past the most segments', () => {
    expect(splitSegment(ONE, 0, 0.001)).toBeUndefined();
    expect(splitSegment(ONE, 0, 0)).toBeUndefined();
    expect(splitSegment(ONE, 1, 0.5)).toBeUndefined();
    let curve: Curve = ONE;
    while (curve.length < MAX_CURVE_SEGMENTS) {
      // Splits the widest segment, so no two anchors get too close.
      const widths = curve.map(s => s.end.x - s.start.x);
      curve = splitSegment(curve, widths.indexOf(Math.max(...widths)), 0.5)!;
    }
    expect(splitSegment(curve, 0, 0.5)).toBeUndefined();
  });
});

describe('removeAnchor', () => {
  it('joins the two segments around it', () => {
    const removed = removeAnchor(TWO, 1);
    expect(removed).toHaveLength(1);
    expect(parseCurve(curveToString(removed!))).toEqual(removed);
  });

  it('about undoes splitting a segment', () => {
    const removed = removeAnchor(splitSegment(ONE, 0, 0.5)!, 1)!;
    expect(removed).toHaveLength(1);
    expect(removed[0].cp1.x).toBeCloseTo(0.4, 1);
    expect(removed[0].cp2.y).toBeCloseTo(1, 1);
  });

  it("doesn't remove the ends", () => {
    expect(removeAnchor(TWO, 0)).toBeUndefined();
    expect(removeAnchor(TWO, 2)).toBeUndefined();
    expect(isInteriorAnchor(TWO, 1)).toBe(true);
    expect(isInteriorAnchor(TWO, 2)).toBe(false);
  });
});

describe('findNearestPoint', () => {
  it('finds the segment and t nearest to a point', () => {
    const nearest = findNearestPoint(TWO, { x: 0.5, y: 0.62 });
    expect(nearest?.distance).toBeLessThan(0.05);
    expect(getHandlePoint(TWO, { type: 'anchor', index: 1 })).toEqual({ x: 0.5, y: 0.6 });
    expect(nearest?.segment === 0 ? nearest.t : 1 - (nearest?.t ?? 0)).toBeGreaterThan(0.9);
  });

  it('measures after mapping the points', () => {
    // With y stretched, the nearest point is the one nearest in y.
    const line = parse('M 0 0 L 1 1');
    const nearest = findNearestPoint(line, { x: 0.2, y: 0.5 }, p => ({ x: p.x, y: p.y * 100 }));
    expect(nearest?.t).toBeCloseTo(0.5, 2);
  });
});

describe('getCurveYRange', () => {
  it('grows [0, 1] to hold the curve', () => {
    expect(getCurveYRange(ONE)).toEqual({ min: 0, max: 1 });
    expect(getCurveYRange(PRESET_CURVES.ANTICIPATE_OVERSHOOT).min).toBeLessThan(0);
    expect(getCurveYRange(PRESET_CURVES.OVERSHOOT).max).toBeGreaterThan(1);
  });
});
