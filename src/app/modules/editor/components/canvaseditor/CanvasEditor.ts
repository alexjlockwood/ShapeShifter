import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import type {
  CanvasEditor,
  CanvasEditorContext,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { Point } from 'app/modules/editor/scripts/common';
import { on } from 'app/modules/editor/scripts/dom';
import { ShortcutService } from 'app/modules/editor/services/shortcut.service';
import { isActionMode } from 'app/modules/editor/store/actionmode/selectors';
import { getHiddenLayerIds, getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import {
  getAnimatedVectorLayer,
  getCurrentTime,
} from 'app/modules/editor/store/playback/selectors';
import { environment } from 'environments/environment';
import { combineLatest, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { EditorRenderer } from './EditorRenderer';
import { Modifiers, SelectTool } from './SelectTool';
import { duplicateLayers, getTopmostLayerIds, translateLayers } from './transformLayers';

// How far the arrow keys move the selection, in viewport units, and with Shift held.
const NUDGE = 1;
const BIG_NUDGE = 10;
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// The entry point of the canvas editor's lazily loaded code (see docs/canvas-editor.md). Dev builds
// also let the end-to-end tests drive its preview, as window.shapeshifter.canvasEditor.

export function createCanvasEditor(context: CanvasEditorContext): CanvasEditor {
  const editor = new Editor(context);
  try {
    editor.init();
  } catch (error) {
    // Nothing it started is left listening.
    editor.dispose();
    throw error;
  }
  return editor;
}

class Editor implements CanvasEditor {
  private camera: CanvasCamera | undefined;
  private vectorLayer: VectorLayer;
  private hiddenLayerIds: ReadonlySet<string> = new Set();
  private selectedLayerIds: ReadonlySet<string> = new Set();
  private isActionMode = false;
  private readonly renderer: EditorRenderer;
  private readonly selectTool: SelectTool;
  private subscription: Subscription | undefined;
  private removeKeyListener: (() => void) | undefined;
  private removeTestHooks: (() => void) | undefined;

  constructor(private readonly context: CanvasEditorContext) {
    const { store, services, preview } = context;
    this.renderer = new EditorRenderer(context.canvas);
    this.vectorLayer = getAnimatedVectorLayer(store.getState()).vl;
    this.selectTool = new SelectTool({
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      getSelectedLayerIds: () => this.selectedLayerIds,
      setSelectedLayerIds: layerIds =>
        services.layerTimelineService.setSelectedLayers(new Set(layerIds)),
      toViewportLength: length => this.camera?.toViewportLength(length) ?? length,
      render: document => this.render(document),
      preview,
      redraw: () => this.draw(),
    });
  }

  init() {
    const { store, preview } = this.context;
    this.subscription = combineLatest([
      store.select(getAnimatedVectorLayer),
      preview.asObservable().pipe(startWith(undefined)),
      store.select(getHiddenLayerIds),
      store.select(getSelectedLayerIds),
      store.select(isActionMode),
    ]).subscribe(([{ vl, currentTime }, , hiddenLayerIds, selectedLayerIds, actionMode]) => {
      this.vectorLayer = preview.apply(vl, currentTime);
      this.hiddenLayerIds = hiddenLayerIds;
      this.selectedLayerIds = selectedLayerIds;
      if (actionMode && !this.isActionMode) {
        this.selectTool.onLeave();
      }
      this.isActionMode = actionMode;
      this.draw();
    });
    // Before the keyboard shortcuts, so that the arrow keys nudge instead of rewinding.
    this.removeKeyListener = on(window, 'keydown', event => this.onKeyDown(event), {
      capture: true,
    });
    this.removeTestHooks = environment.production ? undefined : addTestHooks(preview);
  }

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    this.renderer.setCamera(camera);
    this.draw();
  }

  onPress(event: PointerEvent, point: Point) {
    this.selectTool.onPress(point, getModifiers(event));
  }

  onMove(event: PointerEvent, point: Point) {
    this.selectTool.onMove(point, getModifiers(event));
  }

  onRelease(_: PointerEvent, point: Point) {
    this.selectTool.onRelease(point);
  }

  onLeave() {
    this.selectTool.onLeave();
  }

  dispose() {
    this.subscription?.unsubscribe();
    this.removeKeyListener?.();
    this.removeTestHooks?.();
    this.renderer.clear();
  }

  /** Returns the document's vector layer as it's drawn at the current time. */
  private render(document: CanvasDocument) {
    const currentTime = getCurrentTime(this.context.store.getState());
    return new AnimationRenderer(document.vectorLayer, document.animation).setCurrentTime(
      currentTime,
    );
  }

  private onKeyDown(event: KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : undefined;
    if (
      this.isActionMode ||
      !this.selectedLayerIds.size ||
      target?.closest('.MuiModal-root') ||
      document.activeElement?.matches('input, textarea, [contenteditable]')
    ) {
      return undefined;
    }
    const arrow = ARROWS[event.key];
    if (arrow && !event.altKey && !event.metaKey && !event.ctrlKey) {
      const distance = event.shiftKey ? BIG_NUDGE : NUDGE;
      this.edit(base =>
        translateLayers(
          base,
          this.render(base),
          this.selectedLayerIds,
          arrow[0] * distance,
          arrow[1] * distance,
        ),
      );
      return false;
    }
    if (event.key.toLowerCase() === 'd' && ShortcutService.isOsDependentModifierKey(event)) {
      // Duplicates in place, and selects the copies. It keeps the browser from bookmarking the
      // page too.
      let copyIds: ReadonlySet<string> = new Set();
      this.edit(
        base => {
          const duplicated = duplicateLayers(
            base,
            getTopmostLayerIds(base.vectorLayer, this.selectedLayerIds),
          );
          copyIds = new Set(duplicated.layerIds);
          return duplicated.document;
        },
        () => copyIds,
      );
      return false;
    }
    return undefined;
  }

  /** Makes an edit from the document as it is, as one undo step. */
  private edit(
    fn: (base: CanvasDocument) => CanvasDocument,
    getSelectedLayerIds: () => ReadonlySet<string> | undefined = () => undefined,
  ) {
    const { preview } = this.context;
    preview.begin();
    const base = preview.getBase();
    if (base) {
      const document = fn(base);
      preview.setDocument(document, getSelectedLayerIds());
    }
    preview.commit();
  }

  private draw() {
    const { camera } = this;
    if (!camera) {
      return;
    }
    if (this.isActionMode) {
      // Action mode has its own selections, drawn by the canvases.
      this.renderer.clear();
      return;
    }
    this.renderer.draw(camera, {
      vectorLayer: this.vectorLayer,
      hoveredLayerId: this.selectTool.getHoveredLayerId(),
      selectedLayerIds: this.selectedLayerIds,
      marquee: this.selectTool.getMarquee(),
    });
  }
}

function getModifiers(event: PointerEvent): Modifiers {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    command: ShortcutService.isOsDependentModifierKey(event),
  };
}

function addTestHooks(preview: CanvasPreview) {
  const devGlobal = (window as { shapeshifter?: { canvasEditor?: unknown } }).shapeshifter;
  if (!devGlobal) {
    return undefined;
  }
  devGlobal.canvasEditor = {
    /** Shows the layer with the path, starting an edit if there isn't one. */
    previewPath(layerId: string, pathData: string) {
      if (!preview.isEditing()) {
        preview.begin();
      }
      preview.setPath(layerId, new Path(pathData));
    },
    commit: () => preview.commit(),
    cancel: () => preview.cancel(),
    isEditing: () => preview.isEditing(),
  };
  return () => {
    delete devGlobal.canvasEditor;
  };
}
