import { range } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import * as BezierEasing from './BezierEasing';
import {
  createCurveEasing,
  type Curve,
  curveToString,
  MAX_CURVE_SEGMENTS,
  normalizeCurve,
  parseCurve,
} from './CustomInterpolator';

function parse(value: string) {
  const curve = parseCurve(value);
  if (!curve) {
    throw new Error(`${value} isn't a curve`);
  }
  return curve;
}

describe('parseCurve', () => {
  it('reads a single cubic', () => {
    expect(parse('M 0 0 C 0.4 0 0.2 1 1 1')).toEqual([
      { start: { x: 0, y: 0 }, cp1: { x: 0.4, y: 0 }, cp2: { x: 0.2, y: 1 }, end: { x: 1, y: 1 } },
    ]);
  });

  it('round trips through curveToString', () => {
    const value = 'M 0 0 C 0.2 0 0 1.4 0.5 1.2 C 0.8 1 0.9 1 1 1';
    expect(curveToString(parse(value))).toBe(value);
    expect(parse(curveToString(parse(value)))).toEqual(parse(value));
  });

  it('writes canonical strings: absolute cubics, rounded to 3 decimals, without -0', () => {
    expect(curveToString(parse('m0,0 c0.12345,-0.00001 0.2,1 1,1'))).toBe(
      'M 0 0 C 0.123 0 0.2 1 1 1',
    );
  });

  it('turns lines and quadratics into cubics with the same shape', () => {
    expect(curveToString(parse('M 0 0 L 0.5 0.5 Q 0.5 1 1 1'))).toBe(
      'M 0 0 C 0.167 0.167 0.333 0.333 0.5 0.5 C 0.5 0.833 0.667 1 1 1',
    );
    // H and V become lines too, though a V always makes two anchors with the same x.
    expect(parseCurve('M 0 0 H 0.5 V 1 L 1 1')).toBeUndefined();
    expect(curveToString(parse('M 0 0 H 0.5 L 1 1'))).toBe(
      'M 0 0 C 0.167 0 0.333 0 0.5 0 C 0.667 0.333 0.833 0.667 1 1',
    );
  });

  it('moves control points into their segment', () => {
    expect(curveToString(parse('M 0 0 C -0.5 0 1.5 1 1 1'))).toBe('M 0 0 C 0 0 1 1 1 1');
    expect(curveToString(parse('M 0 0 C 0.9 0 0.9 0.5 0.5 0.5 C 0.1 0.5 0.6 1 1 1'))).toBe(
      'M 0 0 C 0.5 0 0.5 0.5 0.5 0.5 C 0.5 0.5 0.6 1 1 1',
    );
  });

  it('lets y leave [0, 1]', () => {
    expect(parse('M 0 0 C 0.3 -0.5 0.7 1.8 1 1')[0].cp1.y).toBe(-0.5);
  });

  it.each([
    ['empty', ''],
    ['just a move', 'M 0 0'],
    ['a preset name', 'FAST_OUT_SLOW_IN'],
    ['a closed path', 'M 0 0 C 0.4 0 0.2 1 1 1 Z'],
    ['a second subpath', 'M 0 0 L 0.5 0.5 M 0.5 0.5 L 1 1'],
    ['a start other than (0, 0)', 'M 0.1 0 C 0.4 0 0.2 1 1 1'],
    ['an end other than (1, 1)', 'M 0 0 C 0.4 0 0.2 1 1 0.9'],
    ['anchors going back', 'M 0 0 L 0.6 0.5 L 0.4 0.6 L 1 1'],
    ['two anchors at the same x', 'M 0 0 L 0.5 0.2 L 0.5 0.8 L 1 1'],
    ['NaN', 'M 0 0 C NaN 0 0.2 1 1 1'],
    ['Infinity', 'M 0 0 C Infinity 0 0.2 1 1 1'],
    ['other characters', 'M 0 0 C 0.4 0 0.2 1 1 1; alert(1)'],
  ])('rejects %s', (_, value) => {
    expect(parseCurve(value)).toBeUndefined();
  });

  it.each([undefined, null, 42, {}, []])('rejects a non-string (%p)', value => {
    expect(parseCurve(value)).toBeUndefined();
  });

  it(`allows at most ${MAX_CURVE_SEGMENTS} segments`, () => {
    const lines = (n: number) =>
      'M 0 0 ' +
      range(1, n + 1)
        .map(i => `L ${i / n} ${i / n}`)
        .join(' ');
    expect(parseCurve(lines(MAX_CURVE_SEGMENTS))).toHaveLength(MAX_CURVE_SEGMENTS);
    expect(parseCurve(lines(MAX_CURVE_SEGMENTS + 1))).toBeUndefined();
  });

  it('reads arcs, which the path parser turns into cubics', () => {
    const curve = parse('M 0 0 A 1 1 0 0 0 1 1');
    expect(curve.length).toBeGreaterThan(0);
    expect(curve[curve.length - 1].end).toEqual({ x: 1, y: 1 });
  });
});

describe('normalizeCurve', () => {
  it('rejects curves whose anchors round to the same x', () => {
    const curve: Curve = [
      { start: { x: 0, y: 0 }, cp1: { x: 0, y: 0 }, cp2: { x: 0, y: 0 }, end: { x: 0.0001, y: 0 } },
      {
        start: { x: 0.0001, y: 0 },
        cp1: { x: 0.5, y: 0 },
        cp2: { x: 0.5, y: 1 },
        end: { x: 1, y: 1 },
      },
    ];
    expect(normalizeCurve(curve)).toBeUndefined();
  });
});

describe('createCurveEasing', () => {
  it('matches BezierEasing for a single cubic', () => {
    const easing = createCurveEasing(parse('M 0 0 C 0.4 0 0.2 1 1 1'));
    const expected = BezierEasing.create(0.4, 0, 0.2, 1);
    for (const f of range(0, 1.0001, 0.05)) {
      expect(easing(f)).toBeCloseTo(expected(f), 6);
    }
  });

  it('returns the ends outside of [0, 1]', () => {
    const easing = createCurveEasing(parse('M 0 0 C 0.4 0 0.2 1 1 1'));
    expect(easing(-1)).toBe(0);
    expect(easing(0)).toBe(0);
    expect(easing(1)).toBe(1);
    expect(easing(2)).toBe(1);
  });

  it('follows each segment of a curve with several', () => {
    // Straight lines, so y is easy to compute at any x.
    const easing = createCurveEasing(parse('M 0 0 L 0.5 0.8 L 1 1'));
    expect(easing(0.25)).toBeCloseTo(0.4, 4);
    expect(easing(0.5)).toBeCloseTo(0.8, 4);
    expect(easing(0.75)).toBeCloseTo(0.9, 4);
  });

  it('handles steep and flat segments', () => {
    const easing = createCurveEasing(parse('M 0 0 C 0 1 0 1 0.1 1 C 1 1 1 1 1 1'));
    for (const f of range(0, 1.0001, 0.01)) {
      expect(Number.isFinite(easing(f))).toBe(true);
    }
    expect(easing(0.5)).toBeCloseTo(1, 4);
  });
});
