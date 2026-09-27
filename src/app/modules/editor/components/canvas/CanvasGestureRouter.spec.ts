import { describe, expect, it } from 'vitest';

import { CanvasGestureRouter } from './CanvasGestureRouter';

const MOUSE = { pointerId: 1, button: 0, isPrimary: true };

describe('CanvasGestureRouter', () => {
  it('starts a gesture with a press, gives it the moves, and ends it with a release', () => {
    const router = new CanvasGestureRouter();
    expect(router.down(MOUSE)).toEqual({ canceled: false, started: true });
    expect(router.isActive()).toBe(true);
    expect(router.move(MOUSE)).toBe(true);
    expect(router.up(MOUSE)).toBe(true);
    // The gesture is over by the time the release is handled.
    expect(router.isActive()).toBe(false);
    // Losing the capture after a release doesn't cancel anything.
    expect(router.cancel(MOUSE.pointerId)).toBe(false);
  });

  it('treats moves without a gesture as hovers', () => {
    const router = new CanvasGestureRouter();
    expect(router.move(MOUSE)).toBe(true);
    expect(router.leave()).toBe(true);
    expect(router.up(MOUSE)).toBe(false);
  });

  // CANVAS-11: right-clicks used to add points, change modes, and select layers.
  it('ignores right and middle clicks', () => {
    const router = new CanvasGestureRouter();
    expect(router.down({ ...MOUSE, button: 2 }).started).toBe(false);
    expect(router.down({ ...MOUSE, button: 1 }).started).toBe(false);
    expect(router.isActive()).toBe(false);
  });

  it('treats a click with Ctrl held as a right-click on Macs', () => {
    expect(new CanvasGestureRouter(true).down({ ...MOUSE, ctrlKey: true }).started).toBe(false);
    expect(new CanvasGestureRouter(false).down({ ...MOUSE, ctrlKey: true }).started).toBe(true);
  });

  it('ends the gesture like a release when a move shows the mouse button is up', () => {
    const router = new CanvasGestureRouter();
    router.down(MOUSE);
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'mouse', buttons: 1 })).toBe(false);
    // Another button held down doesn't keep the gesture going.
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'mouse', buttons: 2 })).toBe(true);
    expect(router.isActive()).toBe(false);
    // The release or the capture's loss that comes after it, and a pointercancel, are ignored,
    // and the move and the ones after it are hovers.
    expect(router.up(MOUSE)).toBe(false);
    expect(router.cancel(MOUSE.pointerId)).toBe(false);
    expect(router.move(MOUSE)).toBe(true);
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'mouse', buttons: 0 })).toBe(false);
  });

  it("only ends a gesture early for the gesture's mouse", () => {
    const router = new CanvasGestureRouter();
    router.down(MOUSE);
    // Pens and touches report buttons differently, and some events don't report them at all.
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'pen', buttons: 0 })).toBe(false);
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'touch', buttons: 0 })).toBe(false);
    expect(router.upWithoutRelease({ ...MOUSE, pointerType: 'mouse' })).toBe(false);
    expect(
      router.upWithoutRelease({ ...MOUSE, pointerId: 2, pointerType: 'mouse', buttons: 0 }),
    ).toBe(false);
    expect(router.isActive()).toBe(true);
    expect(router.up(MOUSE)).toBe(true);
  });

  it('ignores other pointers during a gesture, and a second finger', () => {
    const router = new CanvasGestureRouter();
    const finger = { pointerId: 2, button: 0, isPrimary: true };
    const secondFinger = { pointerId: 3, button: 0, isPrimary: false };
    router.down(finger);
    expect(router.down(secondFinger).started).toBe(false);
    expect(router.move(secondFinger)).toBe(false);
    expect(router.up(secondFinger)).toBe(false);
    expect(router.cancel(secondFinger.pointerId)).toBe(false);
    expect(router.isActive()).toBe(true);
    expect(router.up(finger)).toBe(true);
  });

  it("keeps a gesture going when the pointer leaves, since it's captured", () => {
    const router = new CanvasGestureRouter();
    router.down(MOUSE);
    expect(router.leave()).toBe(false);
    expect(router.move(MOUSE)).toBe(true);
  });

  it('cancels the gesture', () => {
    const router = new CanvasGestureRouter();
    router.down(MOUSE);
    expect(router.cancel()).toBe(true);
    expect(router.isActive()).toBe(false);
    expect(router.cancel()).toBe(false);
    expect(router.up(MOUSE)).toBe(false);
  });

  it('cancels a gesture that never saw its release when the next one starts', () => {
    const router = new CanvasGestureRouter();
    router.down(MOUSE);
    expect(router.down(MOUSE)).toEqual({ canceled: true, started: true });
    expect(router.isActive()).toBe(true);
  });
});
