import { getLayerBounds } from 'app/modules/editor/components/canvas/LayerGeometry';
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
}

/** A snap to draw: a vertical line at x = value, or a horizontal one at y = value. */
export interface SnapGuide {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly from: number;
  readonly to: number;
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
 * Returns what snaps: the artboard's edges and middle, and the edges and middles of the visible
 * paths that aren't moving. The pixel grid is separate (see snapBounds).
 */
export function getSnapTargets(
  vl: VectorLayer,
  movingLayerIds: Iterable<string>,
  hiddenLayerIds: ReadonlySet<string>,
): SnapTargets {
  const x: SnapLine[] = [];
  const y: SnapLine[] = [];
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
      }
    }
    layer.children.forEach(recurseFn);
  })(vl);
  return { x, y };
}

/**
 * Returns how far to move the box so that its closest edge or middle on each axis lines up with a
 * target in range. Without a target in range, it snaps an edge to the pixel grid instead, since
 * icons are drawn on whole units, but doesn't draw a guide for it.
 */
export function snapBounds(
  box: Rect,
  targets: SnapTargets,
  thresholds: SnapThresholds,
  axes: { readonly x: boolean; readonly y: boolean } = { x: true, y: true },
): Snap {
  const { l, t, r, b } = box;
  const sx = axes.x ? snapAxis([l, (l + r) / 2, r], targets.x, thresholds) : NO_AXIS_SNAP;
  const sy = axes.y ? snapAxis([t, (t + b) / 2, b], targets.y, thresholds) : NO_AXIS_SNAP;
  if (!sx.delta && !sy.delta && !sx.lines.length && !sy.lines.length) {
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
  ];
  return { dx: sx.delta, dy: sy.delta, guides };
}

const NO_AXIS_SNAP = { delta: 0, lines: [] as ReadonlyArray<SnapLine> };

/**
 * Snaps the closest of the values (an edge, the middle, and the other edge) to the closest line in
 * range, or else an edge to the pixel grid. Returns how far to move, and the lines it lines up
 * with, e.g. both edges of a target the same size.
 */
function snapAxis(
  values: ReadonlyArray<number>,
  lines: ReadonlyArray<SnapLine>,
  thresholds: SnapThresholds,
) {
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
