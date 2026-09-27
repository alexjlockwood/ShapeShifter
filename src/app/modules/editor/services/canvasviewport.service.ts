import type { Point } from 'app/modules/editor/scripts/common';
import type { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { isBeingReset } from 'app/modules/editor/store/reset/selectors';
import { isEqual } from 'lodash-es';
import { BehaviorSubject, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, skip } from 'rxjs/operators';

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

/**
 * Holds the canvas's zoom and pan, which the three canvases in action mode share. It's kept out of
 * the store, since it changes with every scroll and pinch and isn't part of the document, so undo
 * leaves it alone.
 */
export class CanvasViewportService {
  private readonly view = new BehaviorSubject<CanvasView>(FIT_VIEW);
  private readonly subscription = new Subscription();

  constructor(store: Store<State>) {
    // A new project, or a viewport of a different size, starts out fit to the canvas.
    this.subscription.add(
      store
        .select(isBeingReset)
        .pipe(filter(Boolean))
        .subscribe(() => this.fit()),
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

  dispose() {
    this.subscription.unsubscribe();
  }
}
