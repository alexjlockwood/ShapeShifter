import { Point } from 'app/modules/editor/scripts/common';
import { on } from 'app/modules/editor/scripts/dom';
import { CanvasViewportService } from 'app/modules/editor/services/canvasviewport.service';
import { Subscription } from 'rxjs';

import { CanvasCamera } from './CanvasCamera';

// How much a wheel zooms, per pixel it scrolls. A mouse wheel's notch is about 100 pixels, which
// zooms by the square root of 2.
const WHEEL_ZOOM_SPEED = 1 / 200;
// Wheels that scroll by lines or pages instead of pixels, which Firefox's can.
const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 800;

// Safari's pinch events, which aren't in TypeScript's DOM types.
interface GestureEvent extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Zooms and pans the canvas, like in Figma: pinching or scrolling with Cmd or Ctrl held zooms
 * around the pointer, scrolling pans, and dragging with the space bar or the middle button held
 * pans too. It listens to the whole panel, and takes a pan's pointer events before the artboard
 * can start a gesture with them.
 */
export class CanvasNavigation {
  private pan: { readonly pointerId: number; last: Point } | undefined;
  private pinchStartScale: number | undefined;
  private ignoreNextClick = false;
  private removeListeners: ReadonlyArray<() => void> = [];
  private subscription: Subscription | undefined;

  constructor(
    private readonly root: HTMLElement,
    private readonly canvasViewportService: CanvasViewportService,
    private readonly getCamera: () => CanvasCamera | undefined,
  ) {}

  init() {
    const { root } = this;
    const onGesture = (type: string, listener: (event: GestureEvent) => void) => {
      const wrappedListener = (event: Event) => {
        // Otherwise Safari zooms the page.
        event.preventDefault();
        listener(event as GestureEvent);
      };
      root.addEventListener(type, wrappedListener);
      return () => root.removeEventListener(type, wrappedListener);
    };
    this.removeListeners = [
      // React's wheel listeners are passive, so they can't keep the page from scrolling.
      on(root, 'wheel', event => this.onWheel(event), { passive: false }),
      onGesture('gesturestart', () => {
        this.pinchStartScale = this.getCamera()?.scale;
      }),
      onGesture('gesturechange', event => this.onPinch(event)),
      onGesture('gestureend', () => {
        this.pinchStartScale = undefined;
      }),
      // Before the artboard sees the press, so that it doesn't start a gesture too.
      on(root, 'pointerdown', event => this.onPointerDown(event), { capture: true }),
      on(root, 'pointermove', event => this.onPointerMove(event)),
      on(root, 'pointerup', event => this.endPan(event.pointerId)),
      on(root, 'pointercancel', event => this.endPan(event.pointerId)),
      on(root, 'lostpointercapture', event => this.endPan(event.pointerId)),
      // Pressing the middle button would start scrolling the page, and releasing it could open a
      // link.
      on(root, 'mousedown', event => (event.button === 1 ? false : undefined)),
      on(root, 'auxclick', event => (event.button === 1 ? false : undefined)),
      // A pan with the main button still ends with a click, which would clear the selection.
      on(
        root,
        'click',
        () => {
          if (!this.ignoreNextClick) {
            return undefined;
          }
          this.ignoreNextClick = false;
          return false;
        },
        { capture: true },
      ),
      on(window, 'blur', () => this.endPan()),
      on(
        window,
        'keydown',
        event => (event.key === 'Escape' && this.endPan() ? false : undefined),
        { capture: true },
      ),
    ];
    this.subscription = this.canvasViewportService.isSpaceHeldObservable().subscribe(isHeld => {
      root.classList.toggle('is-space-held', isHeld);
    });
  }

  dispose() {
    this.endPan();
    this.removeListeners.forEach(remove => remove());
    this.removeListeners = [];
    this.subscription?.unsubscribe();
  }

  private toPanelPoint(event: { readonly clientX: number; readonly clientY: number }) {
    const { left, top } = this.root.getBoundingClientRect();
    return { x: event.clientX - left, y: event.clientY - top };
  }

  private onWheel(event: WheelEvent) {
    const camera = this.getCamera();
    if (!camera) {
      return undefined;
    }
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_HEIGHT
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? PAGE_HEIGHT
          : 1;
    let dx = event.deltaX * unit;
    let dy = event.deltaY * unit;
    if (event.ctrlKey || event.metaKey) {
      // Trackpad pinches arrive as wheel events with Ctrl held, in Chrome and Firefox.
      const scale = camera.scale * 2 ** (-dy * WHEEL_ZOOM_SPEED);
      this.canvasViewportService.setView(camera.zoomAround(this.toPanelPoint(event), scale));
      return false;
    }
    if (event.shiftKey && !dx) {
      // Mouse wheels scroll sideways with Shift held, except on macOS, which does it already.
      [dx, dy] = [dy, 0];
    }
    this.canvasViewportService.setView(camera.panBy(-dx, -dy));
    return false;
  }

  private onPinch(event: GestureEvent) {
    const camera = this.getCamera();
    if (!camera || this.pinchStartScale === undefined) {
      return;
    }
    const scale = this.pinchStartScale * event.scale;
    this.canvasViewportService.setView(camera.zoomAround(this.toPanelPoint(event), scale));
  }

  private onPointerDown(event: PointerEvent) {
    this.ignoreNextClick = false;
    const isPan =
      event.isPrimary &&
      (event.button === 1 || (event.button === 0 && this.canvasViewportService.isSpaceHeld()));
    if (!isPan || this.pan) {
      return undefined;
    }
    this.pan = { pointerId: event.pointerId, last: { x: event.clientX, y: event.clientY } };
    try {
      this.root.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone, e.g. for a synthetic event.
    }
    this.root.classList.add('is-panning');
    // Keeps the artboard from starting a gesture. The default isn't prevented, so that the press
    // still takes the focus from a text field.
    event.stopPropagation();
    return undefined;
  }

  private onPointerMove(event: PointerEvent) {
    const camera = this.getCamera();
    if (!this.pan || event.pointerId !== this.pan.pointerId || !camera) {
      return;
    }
    const { x, y } = this.pan.last;
    this.pan.last = { x: event.clientX, y: event.clientY };
    this.canvasViewportService.setView(camera.panBy(event.clientX - x, event.clientY - y));
    this.canvasViewportService.notePan();
  }

  /** Returns whether there was a pan to end, for the pointer if one is given. */
  private endPan(pointerId?: number) {
    if (!this.pan || (pointerId !== undefined && pointerId !== this.pan.pointerId)) {
      return false;
    }
    this.pan = undefined;
    this.ignoreNextClick = true;
    this.root.classList.remove('is-panning');
    return true;
  }
}
