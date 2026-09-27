import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasInput } from './CanvasInput';

describe('CanvasInput', () => {
  let element: HTMLElement;
  let input: CanvasInput;
  // What the handler was told, e.g. 'press 10,10', 'move 20,20', 'release 20,20', and 'leave'.
  let calls: string[];

  beforeEach(() => {
    element = document.createElement('div');
    Object.assign(element.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '200px',
      height: '200px',
    });
    document.body.appendChild(element);
    calls = [];
    const at = (type: string) => (event: PointerEvent) =>
      calls.push(`${type} ${event.clientX},${event.clientY}`);
    input = new CanvasInput(element, {
      onPress: at('press'),
      onMove: at('move'),
      onRelease: at('release'),
      onLeave: () => calls.push('leave'),
    });
    input.init();
  });

  afterEach(() => {
    input.dispose();
    element.remove();
  });

  function pointer(type: string, clientX: number, clientY: number, init: PointerEventInit = {}) {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX,
      clientY,
      ...init,
    });
    element.dispatchEvent(event);
    return event;
  }

  /** Presses at 10,10 and drags to 20,20. */
  function drag() {
    pointer('pointerdown', 10, 10, { button: 0, buttons: 1 });
    pointer('pointermove', 20, 20, { buttons: 1 });
  }

  it('ends a gesture with its release', () => {
    drag();
    pointer('pointerup', 22, 22, { button: 0, buttons: 0 });
    // Browsers take the capture away after the release, which ends nothing.
    pointer('lostpointercapture', 22, 22, { buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'release 22,22']);
  });

  it('ends a gesture where it last was when a move shows the button is already up', () => {
    drag();
    // As a macOS trackpad can send right before the release.
    pointer('pointermove', 21, 21, { buttons: 0 });
    pointer('pointerup', 21, 21, { button: 0, buttons: 0 });
    pointer('lostpointercapture', 21, 21, { buttons: 0 });
    // The stray move is a hover once the gesture is over, and the release is ignored.
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'release 20,20', 'move 21,21']);
  });

  it('ends a press without moves where it was pressed', () => {
    pointer('pointerdown', 10, 10, { button: 0, buttons: 1 });
    pointer('pointermove', 11, 11, { buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'release 10,10', 'move 11,11']);
  });

  it('releases once when the capture is lost before the release', () => {
    drag();
    // Chrome takes the capture away before it sends a move with the button up.
    pointer('lostpointercapture', 21, 21, { buttons: 0 });
    pointer('pointermove', 21, 21, { buttons: 0 });
    pointer('pointerup', 21, 21, { button: 0, buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'release 20,20', 'move 21,21']);
  });

  it('keeps a mouse gesture when the capture is lost with the button still down', () => {
    drag();
    // Chrome and Firefox report the button held when the page takes the capture away. Safari
    // reports no buttons, so the two can't be told apart there.
    pointer('lostpointercapture', 20, 20, { buttons: 1 });
    pointer('pointermove', 30, 30, { buttons: 1 });
    pointer('pointerup', 30, 30, { button: 0, buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'release 20,20', 'move 30,30']);
  });

  it("cancels a touch's gesture when the capture is lost", () => {
    const touch = { pointerType: 'touch' };
    pointer('pointerdown', 10, 10, { ...touch, button: 0, buttons: 1 });
    pointer('lostpointercapture', 10, 10, { ...touch, buttons: 1 });
    pointer('pointerup', 10, 10, { ...touch, button: 0, buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'leave']);
  });

  it('ignores the capture lost by another pointer', () => {
    drag();
    pointer('lostpointercapture', 20, 20, { pointerId: 2, buttons: 0 });
    pointer('pointerup', 22, 22, { button: 0, buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'release 22,22']);
  });

  const cancelers: ReadonlyArray<[string, () => void]> = [
    ['pointercancel', () => pointer('pointercancel', 20, 20, { buttons: 0 })],
    [
      'a context menu',
      () =>
        element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
    ],
    ['blur', () => window.dispatchEvent(new Event('blur'))],
    [
      'Escape',
      () => {
        const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
        window.dispatchEvent(escape);
        // Only the gesture, rather than e.g. leaving action mode too.
        expect(escape.defaultPrevented).toBe(true);
      },
    ],
  ];

  it.each(cancelers)('cancels on %s', (_, cancel) => {
    drag();
    cancel();
    // The release that follows, and the capture's loss, don't end anything.
    pointer('pointerup', 22, 22, { button: 0, buttons: 0 });
    pointer('lostpointercapture', 22, 22, { buttons: 0 });
    expect(calls).toEqual(['press 10,10', 'move 20,20', 'leave']);
  });

  it("leaves Escape alone when there's no gesture", () => {
    const escape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(calls).toEqual([]);
  });
});
