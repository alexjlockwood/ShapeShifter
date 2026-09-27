import { getLayerBounds } from 'app/modules/editor/components/canvas/LayerGeometry';
import type { Guide } from 'app/modules/editor/model/guides';
import { Layer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Point, Rect } from 'app/modules/editor/scripts/common';

/** A line that something can snap to, across one axis, with how far it reaches along the other. */
export interface SnapLine {
  readonly value: number;
  readonly from: number;
  readonly to: number;
}

export interface SnapTargets {
  /** Vertical lines, which x values snap to. */
  readonly x: ReadonlyArray<SnapLine>;
  /** Horizontal lines, which y values snap to. */
  readonly y: ReadonlyArray<SnapLine>;
  /** The paths' bounds, which moves space out evenly with (see snapBounds). */
  readonly boxes?: ReadonlyArray<Rect>;
}

/**
 * A snap to draw: a vertical line at x = value, or a horizontal one at y = value. A gap is drawn
 * as a measurement instead, from one box to the next, where a move spaced boxes out evenly.
 */
export interface SnapGuide {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly from: number;
  readonly to: number;
  readonly isGap?: boolean;
}

/** How far to move something to snap it, and the guides to draw for the snaps. */
export interface Snap {
  readonly dx: number;
  readonly dy: number;
  readonly guides: ReadonlyArray<SnapGuide>;
}

/** How close something has to be to snap, in viewport units. */
export interface SnapThresholds {
  /** To the artboard and the other paths. */
  readonly lines: number;
  /** To the pixel grid, which is closer, since it's everywhere. */
  readonly grid: number;
}

const NO_SNAP: Snap = { dx: 0, dy: 0, guides: [] };

/**
 * Returns what snaps: the artboard's edges and middle, the edges and middles of the visible paths
 * that aren't moving, and the guides. The pixel grid is separate (see snapBounds).
 */
export function getSnapTargets(
  vl: VectorLayer,
  movingLayerIds: Iterable<string>,
  hiddenLayerIds: ReadonlySet<string>,
  guides: ReadonlyArray<Guide> = [],
): SnapTargets {
  const x: SnapLine[] = [];
  const y: SnapLine[] = [];
  const boxes: Rect[] = [];
  const addBox = ({ l, t, r, b }: Rect) => {
    for (const value of [l, (l + r) / 2, r]) {
      x.push({ value, from: t, to: b });
    }
    for (const value of [t, (t + b) / 2, b]) {
      y.push({ value, from: l, to: r });
    }
  };
  addBox({ l: 0, t: 0, r: vl.width, b: vl.height });
  const moving = new Set(movingLayerIds);
  (function recurseFn(layer: Layer) {
    if (hiddenLayerIds.has(layer.id) || moving.has(layer.id)) {
      return;
    }
    if (layer instanceof PathLayer) {
      const bounds = getLayerBounds(vl, layer.id);
      if (bounds) {
        addBox(bounds);
        boxes.push(bounds);
      }
    }
    layer.children.forEach(recurseFn);
  })(vl);
  for (const { axis, value } of guides) {
    // A guide already crosses the whole canvas, so its snap guide only covers what snapped to it.
    (axis === 'x' ? x : y).push({ value, from: Infinity, to: -Infinity });
  }
  return { x, y, boxes };
}

/**
 * Returns how far to move the box so that its closest edge or middle on each axis lines up with a
 * target in range. Without a target in range, it snaps an edge to the pixel grid instead, since
 * icons are drawn on whole units, but doesn't draw a guide for it. With gaps on, e.g. for moves,
 * it also snaps the box to space it out evenly with the boxes around it (see snapGap), whichever
 * is closer.
 */
export function snapBounds(
  box: Rect,
  targets: SnapTargets,
  thresholds: SnapThresholds,
  axes: { readonly x: boolean; readonly y: boolean } = { x: true, y: true },
  { gaps = false }: { readonly gaps?: boolean } = {},
): Snap {
  const { l, t, r, b } = box;
  let sx: AxisSnap = axes.x ? snapAxis([l, (l + r) / 2, r], targets.x, thresholds) : NO_AXIS_SNAP;
  let sy: AxisSnap = axes.y ? snapAxis([t, (t + b) / 2, b], targets.y, thresholds) : NO_AXIS_SNAP;
  const boxes = gaps ? (targets.boxes ?? []) : [];
  const gx = axes.x ? snapGap(box, boxes, 'x', thresholds.lines) : undefined;
  const gy = axes.y ? snapGap(box, boxes, 'y', thresholds.lines) : undefined;
  sx = pickSnap(sx, gx);
  sy = pickSnap(sy, gy);
  const isSnapped = (snap: AxisSnap) => !!snap.delta || !!snap.lines.length || !!snap.gaps?.length;
  if (!isSnapped(sx) && !isSnapped(sy)) {
    return NO_SNAP;
  }
  // Each guide reaches from its target to where the box ends up.
  const guides: SnapGuide[] = [
    ...sx.lines.map(line => ({
      axis: 'x' as const,
      value: line.value,
      from: Math.min(line.from, t + sy.delta),
      to: Math.max(line.to, b + sy.delta),
    })),
    ...sy.lines.map(line => ({
      axis: 'y' as const,
      value: line.value,
      from: Math.min(line.from, l + sx.delta),
      to: Math.max(line.to, r + sx.delta),
    })),
    ...(sx.gaps ?? []),
    ...(sy.gaps ?? []),
  ];
  return { dx: sx.delta, dy: sy.delta, guides };
}

interface AxisSnap {
  readonly delta: number;
  readonly lines: ReadonlyArray<SnapLine>;
  /** The gaps to draw, when the box snapped to space out evenly. */
  readonly gaps?: ReadonlyArray<SnapGuide>;
}

const NO_AXIS_SNAP: AxisSnap = { delta: 0, lines: [] };

/**
 * Picks the snap to a line or the snap to a gap, whichever moves less. A line wins a tie, and they
 * both show when they agree. A snap to the pixel grid (a snap without lines) always loses.
 */
function pickSnap(line: AxisSnap, gap: AxisSnap | undefined): AxisSnap {
  if (!gap) {
    return line;
  }
  if (!line.lines.length) {
    return gap;
  }
  if (Math.abs(line.delta - gap.delta) < 1e-9) {
    return { ...line, gaps: gap.gaps };
  }
  return Math.abs(gap.delta) < Math.abs(line.delta) ? gap : line;
}

/**
 * Snaps the box along an axis so that it spaces out evenly with the boxes beside it, like Figma:
 * in the middle of the gap between two neighbors, or as far past one end of a pair of neighbors as
 * they are apart. Only boxes that overlap the box across the axis count, e.g. the ones in the same
 * row for x, and the box can't land on one of them. Returns the snap that moves the box the least,
 * within the threshold, with the gaps to draw.
 */
export function snapGap(
  box: Rect,
  boxes: ReadonlyArray<Rect>,
  axis: 'x' | 'y',
  threshold: number,
): AxisSnap | undefined {
  // Along the axis (start and end), and across it (from and to).
  const span = (rect: Rect) =>
    axis === 'x'
      ? { start: rect.l, end: rect.r, from: rect.t, to: rect.b }
      : { start: rect.t, end: rect.b, from: rect.l, to: rect.r };
  const moving = span(box);
  const size = moving.end - moving.start;
  const row = boxes
    .map(span)
    .filter(other => other.from < moving.to && moving.from < other.to)
    .sort((a, b) => a.start - b.start);
  // Whether no box in the row is between the two values.
  const isClear = (start: number, end: number) =>
    !row.some(other => other.start < end && start < other.end);
  let best: { delta: number; gaps: SnapGuide[] } | undefined;
  const consider = (delta: number, gaps: () => SnapGuide[]) => {
    if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
      best = { delta, gaps: gaps() };
    }
  };
  // A gap's measurement goes across the middle of what it spans.
  const gapGuide = (
    start: number,
    end: number,
    a: { from: number; to: number },
    b: { from: number; to: number },
  ): SnapGuide => {
    const from = Math.max(a.from, b.from);
    const to = Math.min(a.to, b.to);
    return {
      axis: axis === 'x' ? 'y' : 'x',
      value: from <= to ? (from + to) / 2 : (a.from + a.to) / 2,
      from: start,
      to: end,
      isGap: true,
    };
  };
  for (let i = 0; i < row.length; i++) {
    for (let j = 0; j < row.length; j++) {
      const a = row[i];
      const b = row[j];
      const gap = b.start - a.end;
      if (i === j || gap <= 0 || !isClear(a.end, b.start)) {
        continue;
      }
      // In the middle.
      if (size < gap) {
        const start = a.end + (gap - size) / 2;
        consider(start - moving.start, () => [
          gapGuide(a.end, start, a, moving),
          gapGuide(start + size, b.start, moving, b),
        ]);
      }
      // Past b, and before a.
      const after = b.end + gap;
      if (isClear(b.end, after + size)) {
        consider(after - moving.start, () => [
          gapGuide(a.end, b.start, a, b),
          gapGuide(b.end, after, b, moving),
        ]);
      }
      const before = a.start - gap - size;
      if (isClear(before, a.start)) {
        consider(before - moving.start, () => [
          gapGuide(before + size, a.start, moving, a),
          gapGuide(a.end, b.start, a, b),
        ]);
      }
    }
  }
  return best && { delta: best.delta, lines: [], gaps: best.gaps };
}

/**
 * Snaps the closest of the values (an edge, the middle, and the other edge) to the closest line in
 * range, or else an edge to the pixel grid. Returns how far to move, and the lines it lines up
 * with, e.g. both edges of a target the same size.
 */
function snapAxis(
  values: ReadonlyArray<number>,
  lines: ReadonlyArray<SnapLine>,
  thresholds: SnapThresholds,
): AxisSnap {
  let best: number | undefined;
  for (const value of values) {
    for (const line of lines) {
      const delta = line.value - value;
      if (
        Math.abs(delta) <= thresholds.lines &&
        (best === undefined || Math.abs(delta) < Math.abs(best))
      ) {
        best = delta;
      }
    }
  }
  if (best !== undefined) {
    const delta = best;
    const snapped = lines.filter(line =>
      values.some(value => Math.abs(line.value - (value + delta)) < 1e-9),
    );
    return { delta, lines: snapped };
  }
  let gridDelta: number | undefined;
  for (const value of [values[0], values[values.length - 1]]) {
    const delta = Math.round(value) - value;
    if (
      Math.abs(delta) <= thresholds.grid &&
      (gridDelta === undefined || Math.abs(delta) < Math.abs(gridDelta))
    ) {
      gridDelta = delta;
    }
  }
  return { delta: gridDelta ?? 0, lines: [] };
}

/** Snaps a point, like a scale handle, with snapBounds's rules. */
export function snapPoint(
  point: Point,
  targets: SnapTargets,
  thresholds: SnapThresholds,
  axes: { readonly x: boolean; readonly y: boolean } = { x: true, y: true },
): Snap {
  return snapBounds({ l: point.x, t: point.y, r: point.x, b: point.y }, targets, thresholds, axes);
}

/**
 * Snaps a point that's kept at an angle from the origin, e.g. with Shift held, to the pixel grid
 * without leaving the line it's on: along a horizontal or vertical line, the other coordinate
 * rounds, and along a diagonal, the point moves to where x is a whole unit, if that's within the
 * threshold.
 */
export function snapAlongLineToGrid(origin: Point, point: Point, threshold: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (!length) {
    return point;
  }
  let snapped: Point;
  if (Math.abs(dy) < 1e-9) {
    snapped = { x: Math.round(point.x), y: point.y };
  } else if (Math.abs(dx) < 1e-9) {
    snapped = { x: point.x, y: Math.round(point.y) };
  } else {
    const x = Math.round(point.x);
    snapped = { x, y: origin.y + ((x - origin.x) * dy) / dx };
  }
  return Math.hypot(snapped.x - point.x, snapped.y - point.y) <= threshold ? snapped : point;
}
