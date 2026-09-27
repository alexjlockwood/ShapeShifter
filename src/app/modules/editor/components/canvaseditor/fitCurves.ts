import { Point } from 'app/modules/editor/scripts/common';

/** A cubic curve, as its start, its two control points, and its end. */
export type Cubic = readonly [Point, Point, Point, Point];

/**
 * Fits a smooth run of cubic curves through the points, so that every point is within maxError of
 * them, for the pencil. It's Philip Schneider's algorithm from Graphics Gems: fit one curve by
 * least squares, and where it misses by too much, improve the points' times on it with Newton's
 * method, or else split the points where the curve misses most and fit each half, with the same
 * tangent on both sides of the split so that the curves join smoothly.
 */
export function fitCurves(input: ReadonlyArray<Point>, maxError: number): Cubic[] {
  const points = input.filter((p, i) => i === 0 || distance(p, input[i - 1]) > 1e-9);
  if (points.length < 2) {
    return [];
  }
  const last = points.length - 1;
  const leftTangent = normalize(subtract(points[1], points[0]));
  const rightTangent = normalize(subtract(points[last - 1], points[last]));
  return fitCubic(points, 0, last, leftTangent, rightTangent, maxError);
}

// How many times to improve the points' times before splitting, and how far off a curve can be
// for that to be worth trying, as a multiple of maxError.
const MAX_ITERATIONS = 20;
const ITERATION_ERROR = 4;

function fitCubic(
  points: ReadonlyArray<Point>,
  first: number,
  last: number,
  tangent1: Point,
  tangent2: Point,
  maxError: number,
): Cubic[] {
  if (last - first === 1) {
    const length = distance(points[first], points[last]) / 3;
    return [
      [
        points[first],
        add(points[first], scale(tangent1, length)),
        add(points[last], scale(tangent2, length)),
        points[last],
      ],
    ];
  }
  let times = chordLengths(points, first, last);
  let curve = generateCubic(points, first, last, times, tangent1, tangent2);
  let { error, splitIndex } = getMaxError(points, first, last, curve, times);
  if (error < maxError) {
    return [curve];
  }
  if (error < maxError * ITERATION_ERROR) {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      times = reparameterize(points, first, last, times, curve);
      curve = generateCubic(points, first, last, times, tangent1, tangent2);
      ({ error, splitIndex } = getMaxError(points, first, last, curve, times));
      if (error < maxError) {
        return [curve];
      }
    }
  }
  const center = normalize(subtract(points[splitIndex - 1], points[splitIndex + 1]));
  return [
    ...fitCubic(points, first, splitIndex, tangent1, center, maxError),
    ...fitCubic(points, splitIndex, last, scale(center, -1), tangent2, maxError),
  ];
}

/** The least squares curve with the given tangents at its ends (see mergeSegments in PathEdit). */
function generateCubic(
  points: ReadonlyArray<Point>,
  first: number,
  last: number,
  times: ReadonlyArray<number>,
  tangent1: Point,
  tangent2: Point,
): Cubic {
  const start = points[first];
  const end = points[last];
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  times.forEach((u, i) => {
    const [b0, b1, b2, b3] = bernstein(u);
    const a1 = scale(tangent1, b1);
    const a2 = scale(tangent2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const rest = subtract(points[first + i], add(scale(start, b0 + b1), scale(end, b2 + b3)));
    x0 += dot(a1, rest);
    x1 += dot(a2, rest);
  });
  const det = c00 * c11 - c01 * c01;
  const chord = distance(start, end);
  let alpha1 = det ? (x0 * c11 - x1 * c01) / det : 0;
  let alpha2 = det ? (c00 * x1 - c01 * x0) / det : 0;
  // A fit that puts a control point behind its end, or on it, falls back to a third of the chord.
  const epsilon = 1e-6 * chord;
  if (alpha1 < epsilon || alpha2 < epsilon) {
    alpha1 = chord / 3;
    alpha2 = chord / 3;
  }
  return [start, add(start, scale(tangent1, alpha1)), add(end, scale(tangent2, alpha2)), end];
}

function getMaxError(
  points: ReadonlyArray<Point>,
  first: number,
  last: number,
  curve: Cubic,
  times: ReadonlyArray<number>,
) {
  let error = 0;
  let splitIndex = Math.floor((first + last) / 2);
  for (let i = first + 1; i < last; i++) {
    const d = distance(evaluate(curve, times[i - first]), points[i]);
    if (d > error) {
      error = d;
      splitIndex = i;
    }
  }
  return { error, splitIndex };
}

/** Moves each point's time on the curve closer to where the curve is closest to it. */
function reparameterize(
  points: ReadonlyArray<Point>,
  first: number,
  last: number,
  times: ReadonlyArray<number>,
  curve: Cubic,
) {
  const [p0, p1, p2, p3] = curve;
  // The first and second derivatives' control points.
  const d1 = [subtract(p1, p0), subtract(p2, p1), subtract(p3, p2)].map(p => scale(p, 3));
  const d2 = [subtract(d1[1], d1[0]), subtract(d1[2], d1[1])].map(p => scale(p, 2));
  return times.map((u, i) => {
    const offset = subtract(evaluate(curve, u), points[first + i]);
    const derivative = evaluate(d1, u);
    const second = evaluate(d2, u);
    const denominator = dot(derivative, derivative) + dot(offset, second);
    return denominator ? u - dot(offset, derivative) / denominator : u;
  });
}

function chordLengths(points: ReadonlyArray<Point>, first: number, last: number) {
  const lengths = [0];
  for (let i = first + 1; i <= last; i++) {
    lengths.push(lengths[lengths.length - 1] + distance(points[i], points[i - 1]));
  }
  const total = lengths[lengths.length - 1];
  return lengths.map(l => (total ? l / total : 0));
}

function bernstein(u: number) {
  return [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u ** 2 * (1 - u), u ** 3];
}

/** Evaluates a curve of any degree at t with de Casteljau's algorithm. */
function evaluate(curve: ReadonlyArray<Point>, t: number): Point {
  let level = [...curve];
  while (level.length > 1) {
    level = level.slice(1).map((p, i) => ({
      x: level[i].x + (p.x - level[i].x) * t,
      y: level[i].y + (p.y - level[i].y) * t,
    }));
  }
  return level[0];
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(p: Point): Point {
  const length = Math.hypot(p.x, p.y);
  return length ? scale(p, 1 / length) : p;
}
