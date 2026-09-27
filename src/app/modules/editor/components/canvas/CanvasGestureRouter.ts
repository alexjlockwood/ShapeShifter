export interface PointerInfo {
  readonly pointerId: number;
  readonly button: number;
  readonly isPrimary: boolean;
  readonly ctrlKey?: boolean;
}

interface MoveInfo {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  readonly pointerType?: string;
  readonly buttons?: number;
}

/**
 * Decides what the canvas's pointer events mean, one gesture at a time. A press with the main
 * button of the primary pointer starts a gesture, which gets that pointer's moves until it's
 * released or canceled. Moves without a gesture are hovers.
 */
export class CanvasGestureRouter {
  private gesturePointerId: number | undefined;

  constructor(private readonly isMac = false) {}

  isActive() {
    return this.gesturePointerId !== undefined;
  }

  getPointerId() {
    return this.gesturePointerId;
  }

  /**
   * Returns whether the press starts a gesture, and whether a gesture that never saw its release
   * was canceled first (e.g. because the pointer couldn't be captured).
   */
  down({ pointerId, button, isPrimary, ctrlKey }: PointerInfo) {
    // Right and middle clicks, and a second finger, don't start gestures. On Macs, a click with
    // Ctrl held is a right-click too.
    if (button !== 0 || !isPrimary || (this.isMac && ctrlKey)) {
      return { canceled: false, started: false };
    }
    const canceled = this.isActive();
    this.gesturePointerId = pointerId;
    return { canceled, started: true };
  }

  /** Returns whether to handle the move, as part of the gesture or as a hover. */
  move({ pointerId, isPrimary }: MoveInfo) {
    return this.isActive() ? pointerId === this.gesturePointerId : isPrimary;
  }

  /**
   * Returns whether the move shows that the gesture missed its release, since the mouse's main
   * button is up. A context menu can take the release, for example.
   */
  isReleaseMissed({ pointerId, pointerType, buttons }: MoveInfo) {
    return (
      this.isActive() &&
      pointerId === this.gesturePointerId &&
      pointerType === 'mouse' &&
      buttons !== undefined &&
      (buttons & 1) === 0
    );
  }

  /** Returns whether the release ends the gesture, which is over by the time it's handled. */
  up({ pointerId }: Pick<PointerInfo, 'pointerId'>) {
    if (!this.isActive() || pointerId !== this.gesturePointerId) {
      return false;
    }
    this.gesturePointerId = undefined;
    return true;
  }

  /** Returns whether there was a gesture to cancel, for the pointer if one is given. */
  cancel(pointerId?: number) {
    if (!this.isActive() || (pointerId !== undefined && pointerId !== this.gesturePointerId)) {
      return false;
    }
    this.gesturePointerId = undefined;
    return true;
  }

  /** Returns whether the pointer leaving ends a hover. During a gesture, it doesn't. */
  leave() {
    return !this.isActive();
  }
}
