import { on } from 'app/modules/editor/scripts/dom';
import { ShortcutService, TEXT_FIELD_SELECTOR } from 'app/modules/editor/services/shortcut.service';

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
 * a drag keeps going outside of the element and ends wherever the pointer is released. A mouse
 * gesture also ends, where it last was, as soon as a move shows that the button is already up or
 * the element loses the capture. It's canceled if the browser takes the pointer away
 * (pointercancel), the window loses focus, a context menu opens, or Escape is pressed.
 */
export class CanvasInput {
  private readonly router = new CanvasGestureRouter(ShortcutService.isMac());
  private removeListeners: ReadonlyArray<() => void> = [];
  // The gesture's press, or its last move: where it ends if the mouse's button comes up before
  // its release.
  private lastGestureEvent: PointerEvent | undefined;

  constructor(
    private readonly element: HTMLElement,
    private readonly handler: CanvasInputHandler,
  ) {}

  init() {
    const { element, router, handler } = this;
    this.removeListeners = [
      on(element, 'pointerdown', event => {
        // The property inspector applies what was typed when its field loses the focus. A press
        // only takes the focus after this handler, by which time the press has started a gesture
        // (so the editor refuses the edit) or selected something else (so the field is gone), and
        // the value would be lost. Blurring the field first applies it.
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.matches(TEXT_FIELD_SELECTOR)) {
          focused.blur();
        }
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
        this.lastGestureEvent = event;
        handler.onPress(event);
      }),
      on(element, 'pointermove', event => {
        // The move itself is a hover if it ended the gesture.
        this.releaseIfButtonUp(event);
        if (router.move(event)) {
          if (router.isActive()) {
            this.lastGestureEvent = event;
          }
          handler.onMove(event);
        }
      }),
      on(element, 'pointerup', event => {
        if (router.up(event)) {
          this.lastGestureEvent = undefined;
          handler.onRelease(event);
        }
      }),
      on(element, 'pointercancel', event => this.cancel(event.pointerId)),
      // A release also loses the capture, but the gesture has already ended by then.
      on(element, 'lostpointercapture', event => {
        if (event.pointerType === 'mouse') {
          this.releaseOnCaptureLost(event);
        } else {
          this.cancel(event.pointerId);
        }
      }),
      on(element, 'pointerleave', () => {
        if (router.leave()) {
          handler.onLeave();
        }
      }),
      on(element, 'contextmenu', () => {
        this.cancel();
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

  /** Cancels the gesture in progress, if there is one, e.g. when a pinch takes over. */
  cancelGesture() {
    this.cancel();
  }

  private cancel(pointerId?: number) {
    const gesturePointerId = this.router.getPointerId();
    if (!this.router.cancel(pointerId) || gesturePointerId === undefined) {
      return false;
    }
    this.endGesture(gesturePointerId);
    this.handler.onLeave();
    return true;
  }

  /**
   * Ends the gesture as its release would, if the move shows that the mouse's main button is
   * already up. A macOS trackpad can send a move like that right before the release, and a
   * context menu or another window can take the release. Canceling would throw away e.g. the
   * pen's new point. The gesture ends where it last was, rather than where the move is, and the
   * release that follows is ignored.
   */
  private releaseIfButtonUp(event: PointerEvent) {
    if (this.router.upWithoutRelease(event)) {
      this.releaseAtLastEvent(event);
    }
  }

  /**
   * Ends the mouse's gesture as its release would, when the element loses the pointer's capture
   * before the release. Chrome takes the capture away when a move shows that the button is
   * already up (see releaseIfButtonUp), before it sends the move. The event's buttons can't tell
   * that apart from the page taking the capture with the button still down, since Safari reports
   * no buttons in either case (Chrome and Firefox report the button held). So it's kept in every
   * browser rather than canceled in some. The browser takes touches and pens away with
   * pointercancel instead, which still cancels.
   */
  private releaseOnCaptureLost(event: PointerEvent) {
    if (this.router.up(event)) {
      this.releaseAtLastEvent(event);
    }
  }

  private releaseAtLastEvent(event: PointerEvent) {
    const { lastGestureEvent } = this;
    this.endGesture(event.pointerId);
    this.handler.onRelease(lastGestureEvent ?? event);
  }

  /** Cleans up after a gesture that ended without the pointer's release. */
  private endGesture(pointerId: number) {
    this.lastGestureEvent = undefined;
    // Otherwise the element keeps getting the pointer's moves, as hovers, until it's released.
    if (this.element.hasPointerCapture(pointerId)) {
      this.element.releasePointerCapture(pointerId);
    }
  }
}
