import { ActionSource } from 'app/modules/editor/model/actionmode';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { MathUtil, Matrix } from 'app/modules/editor/scripts/common';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { Duration, SnackBarService } from 'app/modules/editor/services/snackbar.service';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { getZoomPanInfo } from 'app/modules/editor/store/paper/selectors';
import type { Features } from 'environments/features';
import { isEqual, round } from 'lodash-es';
import { ReplaySubject, combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { CanvasContainer } from './CanvasContainer';
import type { CanvasEditor } from './CanvasEditorApi';
import { CanvasLayers } from './CanvasLayers';
import { CanvasLayoutMixin, Size } from './CanvasLayoutMixin';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasRuler } from './CanvasRuler';
import { loadCanvasEditor } from './loadCanvasEditor';

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
  private readonly features: Features;
  private readonly snackBarService: SnackBarService;
  private canvasEditor: CanvasEditor | undefined;
  private isDisposed = false;

  constructor(
    private readonly elements: CanvasElements,
    private readonly actionSource: ActionSource,
    private readonly store: Store<State>,
    {
      actionModeService,
      layerTimelineService,
      themeService,
      snackBarService,
      features,
    }: EditorServices,
  ) {
    super();
    this.features = features;
    this.snackBarService = snackBarService;
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
      distinctUntilChanged((a, b) => isEqual(a, b)),
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
    // Only the canvas that shows the current time is editable. In action mode, the start and end
    // canvases next to it are for morphing.
    if (this.features.canvasEditor && this.actionSource === ActionSource.Animated) {
      this.loadEditor();
    }
  }

  // @Override
  dispose() {
    super.dispose();
    this.isDisposed = true;
    this.canvasEditor?.dispose();
    delete this.elements.root.dataset.canvasEditor;
    this.canvasLayers.dispose();
    this.canvasOverlay.dispose();
  }

  private loadEditor() {
    loadCanvasEditor().then(
      editorModule => {
        // The canvas can be removed while the editor loads (StrictMode removes it right away in
        // development).
        if (this.isDisposed) {
          return;
        }
        this.canvasEditor = editorModule.createCanvasEditor();
        // Lets the end-to-end tests wait for the editor.
        this.elements.root.dataset.canvasEditor = 'ready';
      },
      (error: unknown) => {
        if (this.isDisposed) {
          return;
        }
        // The canvas still works without the editor. Loading fails offline if the editor was
        // never cached, and after a deploy that removed the file an old page asks for.
        bugsnagClient.notify(error instanceof Error ? error : String(error), { severity: 'info' });
        this.snackBarService.show("Couldn't load the canvas editor", 'Dismiss', Duration.Long);
      },
    );
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
    const inverseZoomPanMatrix = new Matrix(zoom, 0, 0, zoom, tx, ty).invert();
    if (!inverseZoomPanMatrix) {
      // Do nothing if matrix is non-invertible.
      return;
    }
    const point = MathUtil.transformPoint(
      { x: event.clientX - left, y: event.clientY - top },
      inverseZoomPanMatrix,
    );
    const x = point.x / Math.max(1, this.cssScale);
    const y = point.y / Math.max(1, this.cssScale);
    this.canvasRulers.forEach(r => r.showMouse({ x: round(x), y: round(y) }));
  }

  private hideRuler() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }
}
