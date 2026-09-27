import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import type {
  CanvasEditor,
  CanvasEditorContext,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Point } from 'app/modules/editor/scripts/common';
import { ShortcutService } from 'app/modules/editor/services/shortcut.service';
import { isActionMode } from 'app/modules/editor/store/actionmode/selectors';
import { getHiddenLayerIds, getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import { environment } from 'environments/environment';
import { combineLatest, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { EditorRenderer } from './EditorRenderer';
import { Modifiers, SelectTool } from './SelectTool';

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
  private removeTestHooks: (() => void) | undefined;

  constructor(private readonly context: CanvasEditorContext) {
    const { store, services } = context;
    this.renderer = new EditorRenderer(context.canvas);
    this.vectorLayer = getAnimatedVectorLayer(store.getState()).vl;
    this.selectTool = new SelectTool({
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      getSelectedLayerIds: () => this.selectedLayerIds,
      setSelectedLayerIds: layerIds =>
        services.layerTimelineService.setSelectedLayers(new Set(layerIds)),
      toViewportLength: length => this.camera?.toViewportLength(length) ?? length,
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

  onMove(_: PointerEvent, point: Point) {
    this.selectTool.onMove(point);
  }

  onRelease(_: PointerEvent, point: Point) {
    this.selectTool.onRelease(point);
  }

  onLeave() {
    this.selectTool.onLeave();
  }

  dispose() {
    this.subscription?.unsubscribe();
    this.removeTestHooks?.();
    this.renderer.clear();
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
    isAdding: event.shiftKey || ShortcutService.isOsDependentModifierKey(event),
    isContaining: event.altKey,
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
