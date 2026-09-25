import { ActionSource } from 'app/modules/editor/model/actionmode';
import { MathUtil, Matrix } from 'app/modules/editor/scripts/common';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getZoomPanInfo } from 'app/modules/editor/store/paper/selectors';
import _ from 'lodash';
import { ReplaySubject, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { CanvasContainer } from './CanvasContainer';
import { CanvasLayers } from './CanvasLayers';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasRuler } from './CanvasRuler';

// Canvas margin in css pixels.
const CANVAS_MARGIN = 36;

export interface CanvasElements {
  readonly root: HTMLElement;
  readonly horizontalRuler: HTMLCanvasElement;
  readonly verticalRuler: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly layers: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
}

/**
 * Lays out and draws one of the canvases, and forwards mouse events to its overlay.
 */
export class CanvasController extends CanvasLayoutMixin(DestroyableMixin()) {
  private readonly canvasBounds$ = new ReplaySubject<Size>(1);
  private readonly canvasContainer: CanvasContainer;
  private readonly canvasLayers: CanvasLayers;
  private readonly canvasOverlay: CanvasOverlay;
  private readonly canvasRulers: ReadonlyArray<CanvasRuler>;

  constructor(
    private readonly elements: CanvasElements,
    actionSource: ActionSource,
    private readonly store: Store<State>,
    { actionModeService, layerTimelineService, themeService }: EditorServices,
  ) {
    super();
    this.canvasContainer = new CanvasContainer(elements.container);
    this.canvasLayers = new CanvasLayers(elements.layers, actionSource, store);
    this.canvasOverlay = new CanvasOverlay(
      elements.overlay,
      actionSource,
      store,
      actionModeService,
      layerTimelineService,
    );
    this.canvasRulers = [
      new CanvasRuler(elements.horizontalRuler, 'horizontal', themeService),
      new CanvasRuler(elements.verticalRuler, 'vertical', themeService),
    ];
  }

  init() {
    this.canvasLayers.init();
    this.canvasOverlay.init();

    const activeViewport$ = this.store.select(getVectorLayer).pipe(
      map(vl => ({ w: vl.width, h: vl.height })),
      distinctUntilChanged((a, b) => _.isEqual(a, b)),
    );
    this.registerSubscription(
      combineLatest([this.canvasBounds$, activeViewport$]).subscribe(([bounds, viewport]) => {
        const w = Math.max(1, bounds.w - CANVAS_MARGIN * 2);
        const h = Math.max(1, bounds.h - CANVAS_MARGIN * 2);
        this.setDimensions({ w, h }, viewport);
      }),
    );
    this.registerSubscription(
      this.store.select(getZoomPanInfo).subscribe(info => {
        this.setZoomPan(info.zoom, info.translation);
      }),
    );
  }

  // @Override
  dispose() {
    super.dispose();
    this.canvasLayers.dispose();
    this.canvasOverlay.dispose();
  }

  setCanvasBounds(bounds: Size) {
    this.canvasBounds$.next(bounds);
  }

  // @Override
  protected onDimensionsChanged(bounds: Size, viewport: Size) {
    this.layouts.forEach(l => l.setDimensions(bounds, viewport));
  }

  // @Override
  protected onZoomPanChanged(zoom: number, translation: Readonly<{ tx: number; ty: number }>) {
    this.layouts.forEach(l => l.setZoomPan(zoom, translation));
  }

  private get layouts() {
    return [this.canvasContainer, this.canvasLayers, this.canvasOverlay, ...this.canvasRulers];
  }

  onMouseDown(event: MouseEvent) {
    this.canvasOverlay.onMouseDown(event);
    this.showRuler(event);
  }

  onMouseMove(event: MouseEvent) {
    this.canvasOverlay.onMouseMove(event);
    this.showRuler(event);
  }

  onMouseUp(event: MouseEvent) {
    this.canvasOverlay.onMouseUp(event);
    this.showRuler(event);
  }

  onMouseLeave(event: MouseEvent) {
    this.canvasOverlay.onMouseLeave(event);
    this.hideRuler();
  }

  private showRuler(event: MouseEvent) {
    const { left, top } = this.elements.root.getBoundingClientRect();
    const zoom = this.getZoom();
    const { tx, ty } = this.getTranslation();
    const point = MathUtil.transformPoint(
      { x: event.clientX - left, y: event.clientY - top },
      new Matrix(zoom, 0, 0, zoom, tx, ty).invert(),
    );
    const x = point.x / Math.max(1, this.cssScale);
    const y = point.y / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse({ x: _.round(x), y: _.round(y) }));
  }

  private hideRuler() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }
}
