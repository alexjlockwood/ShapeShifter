import { getContextMenuSelection } from 'app/modules/editor/components/contextmenu/contextMenuSelection';
import { ActionSource } from 'app/modules/editor/model/actionmode';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { getCanvasPixelRatio, on, watchDevicePixelRatio } from 'app/modules/editor/scripts/dom';
import { DestroyableMixin } from 'app/modules/editor/scripts/mixins';
import type {
  CanvasView,
  CanvasViewportService,
} from 'app/modules/editor/services/canvasviewport.service';
import type { EditorServices } from 'app/modules/editor/services/createEditorServices';
import { TEXT_FIELD_SELECTOR } from 'app/modules/editor/services/shortcut.service';
import { Duration, SnackBarService } from 'app/modules/editor/services/snackbar.service';
import { State, Store } from 'app/modules/editor/store';
import { isActionMode } from 'app/modules/editor/store/actionmode/selectors';
import {
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import type { Features } from 'environments/features';
import { isEqual, round } from 'lodash-es';
import { combineLatest } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { CanvasCamera, getZoomStep, Size } from './CanvasCamera';
import type { CanvasEditor, CanvasEditorModule } from './CanvasEditorApi';
import { CanvasInput } from './CanvasInput';
import { CanvasLayers } from './CanvasLayers';
import { CanvasNavigation } from './CanvasNavigation';
import { CanvasOverlay } from './CanvasOverlay';
import { CanvasPreview } from './CanvasPreview';
import { CanvasRuler, getRulerCorner } from './CanvasRuler';
import { hitTestLayer } from './LayerGeometry';
import { loadCanvasEditor } from './loadCanvasEditor';

// How close to a layer's outline a right-click hits it, in CSS pixels, as in the select tool.
const LAYER_HIT_TOLERANCE = 6;
// The canvas editor's toolbars, which a right-click on doesn't open the layers' context menu for.
// The keyframe badge opens one for its blocks instead (KeyframeBadge.ts).
const EDITOR_CONTROLS_SELECTOR =
  '.canvas-editor-toolbar, .canvas-editor-pathops, .canvas-editor-keyframe';

export interface CanvasElements {
  /** The panel, which the canvases cover. */
  readonly root: HTMLElement;
  /** The vector layer's bounds, under the canvases. It gets the mouse events. */
  readonly artboard: HTMLElement;
  readonly horizontalRuler: HTMLCanvasElement;
  readonly verticalRuler: HTMLCanvasElement;
  readonly rulerCorner: HTMLElement;
  readonly layers: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
  /** Where the canvas editor draws, when it's on. */
  readonly editor: HTMLCanvasElement;
}

/**
 * Lays out and draws one of the canvases, and forwards pointer events to its overlay.
 */
export class CanvasController extends DestroyableMixin() {
  private viewport: Size | undefined;
  private view: CanvasView | undefined;
  private camera: CanvasCamera | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private stopWatchingPixelRatio: (() => void) | undefined;
  private readonly canvasInput: CanvasInput;
  private readonly canvasNavigation: CanvasNavigation | undefined;
  private readonly canvasPreview: CanvasPreview | undefined;
  private readonly canvasLayers: CanvasLayers;
  private readonly canvasOverlay: CanvasOverlay;
  private readonly canvasRulers: ReadonlyArray<CanvasRuler>;
  private readonly features: Features;
  private readonly snackBarService: SnackBarService;
  private readonly canvasViewportService: CanvasViewportService;
  private canvasEditor: CanvasEditor | undefined;
  private isDisposed = false;
  private isActionMode = false;
  // Who gets the pointer events of the gesture in progress.
  private gestureTarget: 'editor' | 'overlay' | undefined;
  private removeClickListener: (() => void) | undefined;
  private removeContextMenuListener: (() => void) | undefined;

  constructor(
    private readonly elements: CanvasElements,
    private readonly actionSource: ActionSource,
    private readonly store: Store<State>,
    private readonly services: EditorServices,
  ) {
    super();
    const {
      actionModeService,
      canvasViewportService,
      layerTimelineService,
      themeService,
      snackBarService,
      features,
    } = services;
    this.features = features;
    this.snackBarService = snackBarService;
    this.canvasViewportService = canvasViewportService;
    // The editor only works on the canvas that shows the current time.
    this.canvasPreview =
      features.canvasEditor && actionSource === ActionSource.Animated
        ? new CanvasPreview(store, layerTimelineService)
        : undefined;
    this.canvasLayers = new CanvasLayers(elements.layers, actionSource, store, this.canvasPreview);
    this.canvasOverlay = new CanvasOverlay(
      elements.overlay,
      actionSource,
      store,
      actionModeService,
      layerTimelineService,
      this.canvasPreview,
    );
    this.canvasRulers = [
      new CanvasRuler(elements.horizontalRuler, 'horizontal', themeService),
      new CanvasRuler(elements.verticalRuler, 'vertical', themeService),
    ];
    // Zooming and panning come with the editor.
    this.canvasNavigation = features.canvasEditor
      ? new CanvasNavigation(
          elements.root,
          canvasViewportService,
          () => this.camera,
          () => this.canvasInput.cancelGesture(),
        )
      : undefined;
    // With the editor, the main canvas takes the pointer anywhere in the panel, e.g. to start a
    // marquee selection off of the artboard. Otherwise only on the artboard, like before.
    const inputElement = this.canvasPreview ? elements.root : elements.artboard;
    this.canvasInput = new CanvasInput(inputElement, {
      onPress: event => {
        this.gestureTarget = this.getInputTarget();
        // The pointer is captured by the panel, which takes the artboard's :hover away, and with
        // it the rulers.
        if (event.target instanceof Node && elements.artboard.contains(event.target)) {
          elements.root.classList.add('is-pressing-artboard');
        }
        if (this.gestureTarget === 'editor') {
          this.canvasEditor?.onPress(event, this.toViewport(event));
        } else {
          this.canvasOverlay.onMouseDown(event);
        }
        this.showRuler(event);
      },
      onMove: event => {
        if (!this.gestureTarget && this.canvasNavigation?.isPanning()) {
          // The pan has the pointer, so this isn't a hover.
          return;
        }
        if ((this.gestureTarget ?? this.getInputTarget()) === 'editor') {
          this.canvasEditor?.onMove(event, this.toViewport(event));
        } else {
          this.canvasOverlay.onMouseMove(event);
        }
        this.showRuler(event);
      },
      onRelease: event => {
        if ((this.gestureTarget ?? this.getInputTarget()) === 'editor') {
          this.canvasEditor?.onRelease(event, this.toViewport(event));
        } else {
          this.canvasOverlay.onMouseUp(event);
        }
        this.gestureTarget = undefined;
        elements.root.classList.remove('is-pressing-artboard');
        this.showRuler(event);
      },
      onLeave: () => {
        if ((this.gestureTarget ?? this.getInputTarget()) === 'editor') {
          this.canvasEditor?.onLeave();
        } else {
          this.canvasOverlay.onMouseLeave();
        }
        this.gestureTarget = undefined;
        elements.root.classList.remove('is-pressing-artboard');
        this.hideRuler();
      },
    });
  }

  /** The editor gets the pointer events once it's loaded, except in action mode. */
  private getInputTarget() {
    return this.canvasEditor && !this.isActionMode ? 'editor' : 'overlay';
  }

  private toViewport(event: MouseEvent) {
    const { left, top } = this.elements.root.getBoundingClientRect();
    const point = { x: event.clientX - left, y: event.clientY - top };
    return this.camera ? this.camera.panelToViewport(point) : point;
  }

  init() {
    this.canvasPreview?.init();
    this.canvasLayers.init();
    this.canvasOverlay.init();
    this.canvasInput.init();
    this.canvasNavigation?.init();
    this.registerSubscription(
      this.store.select(isActionMode).subscribe(value => {
        this.isActionMode = value;
      }),
    );
    if (this.canvasPreview) {
      // With the editor, the main canvas's rulers show all the time, since guides are dragged out
      // of them, unless Shift+R hides them. Otherwise they show while the pointer is over the
      // artboard, like the ones in action mode.
      this.registerSubscription(
        combineLatest([
          this.services.canvasSettingsService.asObservable(),
          this.store.select(isActionMode),
        ]).subscribe(([{ showRulers }, actionMode]) => {
          const { classList } = this.elements.root;
          classList.toggle('shows-rulers', showRulers && !actionMode);
          classList.toggle('hides-rulers', !showRulers && !actionMode);
        }),
      );
    }
    if (this.actionSource === ActionSource.Animated) {
      this.removeContextMenuListener = on(this.elements.root, 'contextmenu', event =>
        this.onContextMenu(event),
      );
    }
    if (this.canvasPreview) {
      // Touch drags anywhere on the panel are the editor's, e.g. a marquee off of the artboard.
      this.elements.root.classList.add('has-canvas-editor');
      // Clicks on the main canvas are the editor's outside of action mode, so they don't reach the
      // workspace, which would clear the selection after a marquee.
      this.removeClickListener = on(this.elements.root, 'click', event => {
        if (!this.isActionMode) {
          event.stopPropagation();
        }
      });
    }

    this.registerSubscription(
      this.store
        .select(getVectorLayer)
        .pipe(
          map(vl => ({ w: vl.width, h: vl.height })),
          distinctUntilChanged((a, b) => isEqual(a, b)),
        )
        .subscribe(viewport => {
          this.viewport = viewport;
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
    // canvases next to it are for morphing. It's also the one that carries out the zoom
    // shortcuts, which change all three.
    if (this.actionSource === ActionSource.Animated && this.canvasNavigation) {
      this.registerSubscription(
        this.canvasViewportService.getZoomCommands().subscribe(command => {
          const { camera } = this;
          if (!camera) {
            return;
          }
          if (command === 'fit') {
            this.canvasViewportService.fit();
          } else {
            const scale =
              command === '100%' ? 1 : getZoomStep(camera.scale, command === 'in' ? 1 : -1);
            this.canvasViewportService.setView(camera.zoomTo(scale));
          }
        }),
      );
    }
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
    this.canvasInput.dispose();
    this.removeClickListener?.();
    this.removeContextMenuListener?.();
    this.canvasNavigation?.dispose();
    this.resizeObserver?.disconnect();
    this.stopWatchingPixelRatio?.();
    // Canceling an edit in progress tells the editor's gesture, so the editor goes after.
    this.canvasPreview?.dispose();
    if (this.canvasEditor) {
      this.services.canvasEditorBridgeService.detach(this.canvasEditor);
      this.canvasEditor.dispose();
    }
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
    let editor: CanvasEditor | undefined;
    try {
      if (!this.canvasPreview) {
        throw new Error('The canvas editor needs a preview');
      }
      editor = editorModule.createCanvasEditor({
        store: this.store,
        services: this.services,
        preview: this.canvasPreview,
        root: this.elements.root,
        canvas: this.elements.editor,
      });
      if (this.camera) {
        editor.setCamera(this.camera);
      }
    } catch (error) {
      // An editor that didn't finish setting up doesn't get the canvas's input.
      editor?.dispose();
      this.onEditorFailed(error, 'error');
      return;
    }
    this.canvasEditor = editor;
    this.services.canvasEditorBridgeService.attach(editor);
    this.canvasOverlay.setShowsLayerSelections(false);
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
   * Opens the context menu instead of the browser's, for the layer under the pointer, which it
   * selects first if it isn't selected already. With the editor loaded, it finds the layer the way
   * the select tool does, and while a path's points are edited, it selects the point under the
   * pointer the same way. In action mode, no menu opens (ShortcutService keeps the browser's from
   * opening), and over text fields the browser's does. On a Mac, a click with Ctrl held arrives as
   * a context menu too.
   */
  private onContextMenu(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target : undefined;
    if (this.isActionMode || target?.closest(TEXT_FIELD_SELECTOR)) {
      return;
    }
    event.preventDefault();
    if (target?.closest(EDITOR_CONTROLS_SELECTOR)) {
      // The editor's toolbars aren't part of the canvas.
      return;
    }
    const { store, services } = this;
    const { layerTimelineService, contextMenuService } = services;
    const point = this.toViewport(event);
    // While points are edited, the menu acts on the point under the pointer.
    this.canvasEditor?.selectPointAt(point);
    const state = store.getState();
    const hitLayerId = this.canvasEditor
      ? this.canvasEditor.getLayerAt(point)
      : hitTestLayer(getAnimatedVectorLayer(state).vl, point, {
          hiddenLayerIds: getHiddenLayerIds(state),
          tolerance: this.camera?.toViewportLength(LAYER_HIT_TOLERANCE) ?? LAYER_HIT_TOLERANCE,
        })?.id;
    const selection = getContextMenuSelection(
      getVectorLayer(state),
      hitLayerId,
      getSelectedLayerIds(state),
    );
    if (selection) {
      layerTimelineService.setSelectedLayers(new Set(selection));
    }
    contextMenuService.open({ x: event.clientX, y: event.clientY }, 'canvas');
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
    this.canvasEditor?.setCamera(camera);
    // The corner is inside of the artboard, like the rulers.
    const corner = getRulerCorner(camera);
    const { style: cornerStyle } = this.elements.rulerCorner;
    cornerStyle.display = corner ? '' : 'none';
    if (corner) {
      cornerStyle.left = `${corner.x - x}px`;
      cornerStyle.top = `${corner.y - y}px`;
      cornerStyle.width = `${corner.w}px`;
      cornerStyle.height = `${corner.h}px`;
    }
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
