import { ActionSource } from 'app/modules/editor/model/actionmode';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { getCanvasPixelRatio, watchDevicePixelRatio } from 'app/modules/editor/scripts/dom';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import type {
  CanvasView,
  CanvasViewportService,
} from 'app/modules/editor/services/canvasviewport.service';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { Duration, SnackBarService } from 'app/modules/editor/services/snackbar.service';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import type { Features } from 'environments/features';
import { isEqual, round } from 'lodash-es';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { CanvasCamera, Size } from './CanvasCamera';
import type { CanvasEditor, CanvasEditorModule } from './CanvasEditorApi';
import { CanvasLayers } from './CanvasLayers';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasRuler } from './CanvasRuler';
import { loadCanvasEditor } from './loadCanvasEditor';

export interface CanvasElements {
  /** The panel, which the canvases cover. */
  readonly root: HTMLElement;
  /** The vector layer's bounds, under the canvases. It gets the mouse events. */
  readonly artboard: HTMLElement;
  readonly horizontalRuler: HTMLCanvasElement;
  readonly verticalRuler: HTMLCanvasElement;
  readonly layers: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
}

/**
 * Lays out and draws one of the canvases, and forwards mouse events to its overlay.
 */
export class CanvasController extends DestroyableMixin() {
  private viewport: Size | undefined;
  private view: CanvasView | undefined;
  private camera: CanvasCamera | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private stopWatchingPixelRatio: (() => void) | undefined;
  private readonly canvasLayers: CanvasLayers;
  private readonly canvasOverlay: CanvasOverlay;
  private readonly canvasRulers: ReadonlyArray<CanvasRuler>;
  private readonly features: Features;
  private readonly snackBarService: SnackBarService;
  private readonly canvasViewportService: CanvasViewportService;
  private canvasEditor: CanvasEditor | undefined;
  private isDisposed = false;

  constructor(
    private readonly elements: CanvasElements,
    private readonly actionSource: ActionSource,
    private readonly store: Store<State>,
    {
      actionModeService,
      canvasViewportService,
      layerTimelineService,
      themeService,
      snackBarService,
      features,
    }: EditorServices,
  ) {
    super();
    this.features = features;
    this.snackBarService = snackBarService;
    this.canvasViewportService = canvasViewportService;
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

    this.registerSubscription(
      this.store
        .select(getVectorLayer)
        .pipe(
          map(vl => ({ w: vl.width, h: vl.height })),
          distinctUntilChanged((a, b) => isEqual(a, b)),
        )
        .subscribe(viewport => {
          this.viewport = viewport;
          // Root's styles size the canvases in action mode by it.
          const aspectRatio = viewport.w / viewport.h;
          if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
            this.elements.root.style.setProperty('--viewport-aspect-ratio', `${aspectRatio}`);
          }
          this.layout();
        }),
    );
    this.registerSubscription(
      this.canvasViewportService.asObservable().subscribe(view => {
        this.view = view;
        this.layout();
      }),
    );
    // Resize observers call back after layout and before paint, so the canvases never show at
    // the wrong size.
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.elements.root);
    this.stopWatchingPixelRatio = watchDevicePixelRatio(() => this.layout());
    // Only the canvas that shows the current time is editable. In action mode, the start and end
    // canvases next to it are for morphing.
    if (this.actionSource === ActionSource.Animated) {
      if (this.features.canvasEditor) {
        void this.loadEditor();
      } else {
        this.setEditorState('off');
      }
    }
  }

  // @Override
  dispose() {
    super.dispose();
    this.isDisposed = true;
    this.resizeObserver?.disconnect();
    this.stopWatchingPixelRatio?.();
    this.canvasEditor?.dispose();
    this.setEditorState(undefined);
    this.canvasLayers.dispose();
    this.canvasOverlay.dispose();
  }

  private async loadEditor() {
    this.setEditorState('loading');
    let editorModule: CanvasEditorModule;
    try {
      editorModule = await loadCanvasEditor();
    } catch (error) {
      // Loading fails offline if the editor was never cached, and after a deploy that removed the
      // file an old page asks for, so it's expected now and then.
      this.onEditorFailed(error, 'info');
      return;
    }
    // The canvas can be removed while the editor loads (StrictMode removes it right away in
    // development).
    if (this.isDisposed) {
      return;
    }
    try {
      this.canvasEditor = editorModule.createCanvasEditor();
    } catch (error) {
      this.onEditorFailed(error, 'error');
      return;
    }
    this.setEditorState('ready');
  }

  /** The canvas still works without the editor, so it carries on without it. */
  private onEditorFailed(error: unknown, severity: 'info' | 'error') {
    if (this.isDisposed) {
      return;
    }
    bugsnagClient.notify(error instanceof Error ? error : String(error), { severity });
    this.snackBarService.show(
      "Couldn't load the canvas editor. Reload the page to try again.",
      'Dismiss',
      Duration.Long,
    );
    this.setEditorState('failed');
  }

  /**
   * Shows whether the editor is on, loading, ready, or failed to load on the canvas element, so
   * that the end-to-end tests can wait for it.
   */
  private setEditorState(state: 'off' | 'loading' | 'ready' | 'failed' | undefined) {
    if (state) {
      this.elements.root.dataset.canvasEditor = state;
    } else {
      delete this.elements.root.dataset.canvasEditor;
    }
  }

  /** Shows the view in the panel, and redraws everything. */
  private layout() {
    if (!this.viewport || !this.view) {
      return;
    }
    const { width, height } = this.elements.root.getBoundingClientRect();
    const camera = CanvasCamera.create({
      panel: { w: width, h: height },
      viewport: this.viewport,
      pixelRatio: getCanvasPixelRatio(width, height),
      view: this.view,
    });
    this.camera = camera;
    const { x, y, w, h } = camera.getArtboardRect();
    const { style } = this.elements.artboard;
    style.left = `${x}px`;
    style.top = `${y}px`;
    style.width = `${w}px`;
    style.height = `${h}px`;
    this.canvasLayers.setCamera(camera);
    this.canvasOverlay.setCamera(camera);
    this.canvasRulers.forEach(r => r.setCamera(camera));
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
    if (!this.camera) {
      return;
    }
    const { left, top } = this.elements.root.getBoundingClientRect();
    const { x, y } = this.camera.panelToViewport({
      x: event.clientX - left,
      y: event.clientY - top,
    });
    this.canvasRulers.forEach(r => r.showMouse({ x: round(x), y: round(y) }));
  }

  private hideRuler() {
    this.canvasRulers.forEach(r => r.hideMouse());
  }
}
