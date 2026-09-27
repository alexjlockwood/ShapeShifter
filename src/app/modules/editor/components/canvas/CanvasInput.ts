import { on } from 'app/modules/editor/scripts/dom';

import { CanvasGestureRouter } from './CanvasGestureRouter';

export interface CanvasInputHandler {
  /** Starts a gesture. */
  onPress(event: PointerEvent): void;
  /** Continues the gesture, or hovers when there isn't one. */
  onMove(event: PointerEvent): void;
  /** Ends the gesture. */
  onRelease(event: PointerEvent): void;
  /** Cancels the gesture, or ends the hover. */
  onLeave(): void;
}

/**
 * Turns the element's pointer events into gestures and hovers. A gesture captures the pointer, so
 * a drag keeps going outside of the element and ends wherever the pointer is released. It's
 * canceled if the browser takes the pointer away, the window loses focus, or Escape is pressed.
 */
export class CanvasInput {
  private readonly router = new CanvasGestureRouter();
  private removeListeners: ReadonlyArray<() => void> = [];

  constructor(
    private readonly element: HTMLElement,
    private readonly handler: CanvasInputHandler,
  ) {}

  init() {
    const { element, router, handler } = this;
    this.removeListeners = [
      on(element, 'pointerdown', event => {
        // The default isn't prevented, so pressing the canvas still takes the focus from a text
        // field, which is when the property inspector applies what was typed.
        const { canceled, started } = router.down(event);
        if (canceled) {
          handler.onLeave();
        }
        if (!started) {
          return;
        }
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // The pointer is already gone, e.g. for a synthetic event.
        }
        handler.onPress(event);
      }),
      on(element, 'pointermove', event => {
        if (router.move(event)) {
          handler.onMove(event);
        }
      }),
      on(element, 'pointerup', event => {
        if (router.up(event)) {
          handler.onRelease(event);
        }
      }),
      // A release also loses the capture, but the gesture has already ended by then.
      on(element, 'pointercancel', event => this.cancel(event.pointerId)),
      on(element, 'lostpointercapture', event => this.cancel(event.pointerId)),
      on(element, 'pointerleave', () => {
        if (router.leave()) {
          handler.onLeave();
        }
      }),
      on(window, 'blur', () => this.cancel()),
      // This listens before the keyboard shortcuts, so that Escape only cancels the gesture.
      on(
        window,
        'keydown',
        event => (event.key === 'Escape' && this.cancel() ? false : undefined),
        { capture: true },
      ),
    ];
  }

  dispose() {
    this.removeListeners.forEach(remove => remove());
    this.removeListeners = [];
  }

  private cancel(pointerId?: number) {
    if (!this.router.cancel(pointerId)) {
      return false;
    }
    this.handler.onLeave();
    return true;
  }
}
