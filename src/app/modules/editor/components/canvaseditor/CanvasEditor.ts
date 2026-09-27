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

// Pressing or releasing these during a drag changes what it does, e.g. Shift keeps a move straight.
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Shift', 'Alt', 'Meta', 'Control']);

interface Nudge {
  readonly base: CanvasDocument;
  readonly rendered: VectorLayer;
  readonly layerIds: ReadonlyArray<string>;
  // How far it's moved the selection so far.
  x: number;
  y: number;
}

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
  private removeKeyListeners: (() => void) | undefined;
  // An arrow key nudge in progress, which is one undo step however long the key is held.
  private nudge: Nudge | undefined;
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
    const removeListeners = [
      on(window, 'keydown', event => this.onKeyDown(event), { capture: true }),
      on(window, 'keyup', event => this.onKeyUp(event), { capture: true }),
      on(window, 'blur', () => this.endNudge()),
    ];
    this.removeKeyListeners = () => removeListeners.forEach(remove => remove());
    this.removeTestHooks = environment.production ? undefined : addTestHooks(preview);
  }

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    this.renderer.setCamera(camera);
    this.draw();
  }

  onPress(event: PointerEvent, point: Point) {
    this.endNudge();
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
    this.removeKeyListeners?.();
    this.nudge = undefined;
    this.removeTestHooks?.();
    this.renderer.clear();
    delete this.context.root.dataset.editorCursor;
  }

  /** Returns the document's vector layer as it's drawn at the current time. */
  private render(document: CanvasDocument) {
    const currentTime = getCurrentTime(this.context.store.getState());
    return new AnimationRenderer(document.vectorLayer, document.animation).setCurrentTime(
      currentTime,
    );
  }

  private onKeyDown(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.selectTool.onModifiersChange(getModifiers(event));
      return undefined;
    }
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
    const isNudge = !!arrow && !event.altKey && !event.metaKey && !event.ctrlKey;
    const isDuplicate =
      event.key.toLowerCase() === 'd' && ShortcutService.isOsDependentModifierKey(event);
    if (!isNudge && !isDuplicate) {
      return undefined;
    }
    if (this.context.preview.isEditing() && !this.nudge) {
      // A drag is in progress. The keys are swallowed, since rewinding would cancel it.
      return false;
    }
    if (isNudge) {
      const distance = event.shiftKey ? BIG_NUDGE : NUDGE;
      this.nudgeBy(arrow[0] * distance, arrow[1] * distance);
      return false;
    }
    // Duplicates in place, and selects the copies. It keeps the browser from bookmarking the page
    // too.
    this.endNudge();
    const { preview } = this.context;
    preview.begin();
    const base = preview.getBase();
    if (base) {
      const duplicated = duplicateLayers(
        base,
        getTopmostLayerIds(base.vectorLayer, this.selectedLayerIds),
        this.hiddenLayerIds,
      );
      preview.setDocument(duplicated.document, {
        selectedLayerIds: new Set(duplicated.layerIds),
        hiddenLayerIds: duplicated.hiddenLayerIds,
      });
    }
    preview.commit();
    return false;
  }

  private onKeyUp(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.selectTool.onModifiersChange(getModifiers(event));
    }
    if (ARROWS[event.key]) {
      this.endNudge();
    }
  }

  /** Moves the selection, adding to the nudge in progress or starting one. */
  private nudgeBy(dx: number, dy: number) {
    const { preview } = this.context;
    if (!this.nudge) {
      preview.begin(() => {
        // E.g. playback starting while the key is held.
        this.nudge = undefined;
      });
      const base = preview.getBase();
      const layerIds = base ? getTopmostLayerIds(base.vectorLayer, this.selectedLayerIds) : [];
      if (!base || !layerIds.length) {
        // E.g. an empty vector layer is selected.
        preview.cancel();
        return;
      }
      this.nudge = { base, rendered: this.render(base), layerIds, x: 0, y: 0 };
    }
    const nudge = this.nudge;
    nudge.x += dx;
    nudge.y += dy;
    preview.setDocument(
      translateLayers(nudge.base, nudge.rendered, nudge.layerIds, nudge.x, nudge.y),
    );
  }

  /** Commits the nudge in progress, e.g. when the arrow key is released. */
  private endNudge() {
    if (this.nudge) {
      this.nudge = undefined;
      this.context.preview.commit();
    }
  }

  private draw() {
    const { camera } = this;
    if (!camera) {
      return;
    }
    if (this.isActionMode) {
      // Action mode has its own selections, drawn by the canvases.
      this.renderer.clear();
      delete this.context.root.dataset.editorCursor;
      return;
    }
    this.renderer.draw(camera, {
      vectorLayer: this.vectorLayer,
      hoveredLayerId: this.selectTool.getHoveredLayerId(),
      selectedLayerIds: this.selectedLayerIds,
      isShowingHandles: this.selectTool.isShowingHandles(),
      marquee: this.selectTool.getMarquee(),
    });
    // The panel's styles turn this into a cursor (components/canvas/canvas.scss).
    const cursor = this.selectTool.getCursor();
    if (cursor) {
      this.context.root.dataset.editorCursor = cursor;
    } else {
      delete this.context.root.dataset.editorCursor;
    }
  }
}

function getModifiers(event: MouseEvent | KeyboardEvent): Modifiers {
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
