import { describe, expect, it } from 'vitest';

import {
  getHandleCursor,
  getHandlePoint,
  getOppositeHandle,
  getVisibleHandles,
  hitTestHandles,
} from './selectionHandles';

const BOUNDS = { l: 4, t: 4, r: 20, b: 16 };
// Ten CSS pixels per viewport unit.
const toViewportLength = (length: number) => length / 10;

describe('selectionHandles', () => {
  it('puts handles on the corners and the middles of the edges', () => {
    expect(getHandlePoint(BOUNDS, 'nw')).toEqual({ x: 4, y: 4 });
    expect(getHandlePoint(BOUNDS, 'n')).toEqual({ x: 12, y: 4 });
    expect(getHandlePoint(BOUNDS, 'e')).toEqual({ x: 20, y: 10 });
    expect(getHandlePoint(BOUNDS, 'se')).toEqual({ x: 20, y: 16 });
    expect(getOppositeHandle('nw')).toBe('se');
    expect(getOppositeHandle('e')).toBe('w');
  });

  it('leaves out the edge handles when the bounds are small on the screen', () => {
    expect(getVisibleHandles(BOUNDS, toViewportLength)).toHaveLength(8);
    expect(getVisibleHandles(BOUNDS, length => length)).toEqual(['nw', 'ne', 'se', 'sw']);
  });

  it('hits the handles, and the rotation zones just outside of the corners', () => {
    expect(hitTestHandles(BOUNDS, { x: 20.4, y: 16.3 }, toViewportLength)).toEqual({
      type: 'scale',
      handle: 'se',
    });
    expect(hitTestHandles(BOUNDS, { x: 12, y: 3.6 }, toViewportLength)).toEqual({
      type: 'scale',
      handle: 'n',
    });
    expect(hitTestHandles(BOUNDS, { x: 21.2, y: 2.8 }, toViewportLength)).toEqual({
      type: 'rotate',
      corner: 'ne',
    });
    // Inside the bounds, and too far outside.
    expect(hitTestHandles(BOUNDS, { x: 19, y: 15 }, toViewportLength)).toBeUndefined();
    expect(hitTestHandles(BOUNDS, { x: 25, y: 25 }, toViewportLength)).toBeUndefined();
  });

  it('has a cursor for each handle', () => {
    expect(getHandleCursor({ type: 'scale', handle: 'ne' })).toBe('nesw-resize');
    expect(getHandleCursor({ type: 'scale', handle: 's' })).toBe('ns-resize');
    expect(getHandleCursor({ type: 'rotate', corner: 'sw' })).toBe('rotate-sw');
  });
});
