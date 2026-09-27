import { Point, Rect } from 'app/modules/editor/scripts/common';

export type HandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type CornerName = 'nw' | 'ne' | 'se' | 'sw';

export type HandleHit =
  | { readonly type: 'scale'; readonly handle: HandleName }
  | { readonly type: 'rotate'; readonly corner: CornerName };

// In CSS pixels: how big a handle is drawn, how close hits it, and how far past a corner rotates.
export const HANDLE_SIZE = 8;
const HANDLE_HIT_RADIUS = 6;
const ROTATE_ZONE = 20;

const CORNERS: ReadonlyArray<CornerName> = ['nw', 'ne', 'se', 'sw'];
const EDGES: ReadonlyArray<HandleName> = ['n', 'e', 's', 'w'];

/** Returns where the handle is on the bounds, in viewport coordinates. */
export function getHandlePoint({ l, t, r, b }: Rect, handle: HandleName): Point {
  const x = handle.includes('w') ? l : handle.includes('e') ? r : (l + r) / 2;
  const y = handle.includes('n') ? t : handle.includes('s') ? b : (t + b) / 2;
  return { x, y };
}

/** Returns the handle across from this one, which stays put while it scales. */
export function getOppositeHandle(handle: HandleName): HandleName {
  const opposites: Record<HandleName, HandleName> = {
    nw: 'se',
    n: 's',
    ne: 'sw',
    e: 'w',
    se: 'nw',
    s: 'n',
    sw: 'ne',
    w: 'e',
  };
  return opposites[handle];
}

/**
 * Returns the handles to draw. Edge handles are left out when the bounds are too small on the
 * screen to tell them from the corners, like in Figma.
 *
 * @param toViewportLength Converts CSS pixels to viewport units.
 */
export function getVisibleHandles(bounds: Rect, toViewportLength: (length: number) => number) {
  const minSize = toViewportLength(HANDLE_SIZE * 4);
  const hasEdges = bounds.r - bounds.l >= minSize && bounds.b - bounds.t >= minSize;
  return hasEdges ? [...CORNERS, ...EDGES] : [...CORNERS];
}

/**
 * Returns the handle at the point, if any: a scale handle on it, or a corner's rotation zone just
 * outside of the bounds.
 */
export function hitTestHandles(
  bounds: Rect,
  point: Point,
  toViewportLength: (length: number) => number,
): HandleHit | undefined {
  const hitRadius = toViewportLength(HANDLE_HIT_RADIUS);
  for (const handle of getVisibleHandles(bounds, toViewportLength)) {
    const { x, y } = getHandlePoint(bounds, handle);
    if (Math.abs(point.x - x) <= hitRadius && Math.abs(point.y - y) <= hitRadius) {
      return { type: 'scale', handle };
    }
  }
  const isInside =
    bounds.l <= point.x && point.x <= bounds.r && bounds.t <= point.y && point.y <= bounds.b;
  if (isInside) {
    return undefined;
  }
  const rotateZone = toViewportLength(ROTATE_ZONE);
  for (const corner of CORNERS) {
    const { x, y } = getHandlePoint(bounds, corner);
    if (Math.hypot(point.x - x, point.y - y) <= rotateZone) {
      return { type: 'rotate', corner };
    }
  }
  return undefined;
}

/** The CSS cursor for the handle, as the editor's cursor attribute. */
export function getHandleCursor(hit: HandleHit) {
  if (hit.type === 'rotate') {
    return `rotate-${hit.corner}`;
  }
  switch (hit.handle) {
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    default:
      return 'ew-resize';
  }
}
