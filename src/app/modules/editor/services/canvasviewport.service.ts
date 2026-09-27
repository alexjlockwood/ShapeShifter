import type { VectorLayer } from 'app/modules/editor/model/layers';
import type { Point } from 'app/modules/editor/scripts/common';
import type { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { isBeingReset } from 'app/modules/editor/store/reset/selectors';
import { isEqual } from 'lodash-es';
import { BehaviorSubject, combineLatest, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, map, skip } from 'rxjs/operators';

import { HoldSpaceToPan } from './HoldSpaceToPan';

/** Fits the artboard to the canvas. */
export interface FitView {
  readonly type: 'fit';
}

/** Shows the canvas at a scale, in CSS pixels per viewport unit, around a viewport point. */
export interface ManualView {
  readonly type: 'manual';
  readonly scale: number;
  readonly center: Point;
}

export type CanvasView = FitView | ManualView;

export const FIT_VIEW: FitView = { type: 'fit' };

/** The zoom shortcuts. The canvas carries them out, since it knows the scale that fits. */
export type ZoomCommand = 'in' | 'out' | 'fit' | '100%';

/**
 * Holds the canvas's zoom and pan, which the three canvases in action mode share. It's kept out of
 * the store, since it changes with every scroll and pinch and isn't part of the document, so undo
 * leaves it alone. It also knows whether the space bar is held down to pan.
 */
export class CanvasViewportService {
  private readonly view = new BehaviorSubject<CanvasView>(FIT_VIEW);
  private readonly zoomCommands = new Subject<ZoomCommand>();
  private readonly space = new HoldSpaceToPan();
  private readonly isSpaceHeldSubject = new BehaviorSubject(false);
  private readonly subscription = new Subscription();

  // The document from the last reset that was fit.
  private resetVectorLayer: VectorLayer | undefined;

  constructor(store: Store<State>) {
    // A new project, or a viewport of a different size, starts out fit to the canvas. A reset is
    // recognized by its document, since the reset flag stays up until the next action (so two
    // resets in a row look like one), and undo can bring back a state from right after a reset.
    this.subscription.add(
      combineLatest([store.select(isBeingReset), store.select(getVectorLayer)]).subscribe(
        ([isReset, vectorLayer]) => {
          if (isReset && vectorLayer !== this.resetVectorLayer) {
            this.resetVectorLayer = vectorLayer;
            this.fit();
          }
        },
      ),
    );
    this.subscription.add(
      store
        .select(getVectorLayer)
        .pipe(
          map(vl => ({ w: vl.width, h: vl.height })),
          distinctUntilChanged((a, b) => isEqual(a, b)),
          skip(1),
        )
        .subscribe(() => this.fit()),
    );
  }

  getView() {
    return this.view.value;
  }

  asObservable() {
    return this.view.pipe(distinctUntilChanged((a, b) => isEqual(a, b)));
  }

  setView(view: CanvasView) {
    this.view.next(view);
  }

  fit() {
    this.setView(FIT_VIEW);
  }

  zoom(command: ZoomCommand) {
    this.zoomCommands.next(command);
  }

  getZoomCommands() {
    return this.zoomCommands.asObservable();
  }

  pressSpace(event: { readonly repeat: boolean }) {
    this.space.keyDown(event);
    this.isSpaceHeldSubject.next(this.space.isHeld());
  }

  /** Returns whether the press was a tap, which plays or pauses. */
  releaseSpace() {
    const isTap = this.space.keyUp();
    this.isSpaceHeldSubject.next(false);
    return isTap;
  }

  cancelSpace() {
    this.space.reset();
    this.isSpaceHeldSubject.next(false);
  }

  isSpaceHeld() {
    return this.space.isHeld();
  }

  isSpaceHeldObservable() {
    return this.isSpaceHeldSubject.pipe(distinctUntilChanged());
  }

  /** Notes that the canvas panned, so that releasing the space bar doesn't play or pause. */
  notePan() {
    this.space.pan();
  }

  dispose() {
    this.subscription.unsubscribe();
  }
}
