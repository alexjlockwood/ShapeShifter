import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import type {
  CanvasEditor,
  CanvasEditorContext,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { hitTestLayer } from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';
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
import { getLayerPath, PathEditTool } from './PathEditTool';
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

// How close to a layer's outline a press hits it, in CSS pixels, as in SelectTool.
const LAYER_HIT_TOLERANCE = 6;
// Presses closer together than this, in milliseconds and CSS pixels, are a double-click.
const DOUBLE_CLICK_TIME = 500;
const DOUBLE_CLICK_DISTANCE = 4;

interface Nudge {
  // Shows the selection moved by a distance.
  readonly apply: (x: number, y: number) => void;
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
  // The path whose points are being edited, if any. The select tool is used otherwise.
  private pathEdit: PathEditTool | undefined;
  private lastPress: { readonly time: number; readonly point: Point; count: number } | undefined;
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
      editPath: layerId => this.startPathEdit(layerId),
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
      const { pathEdit } = this;
      if (
        pathEdit &&
        (actionMode ||
          selectedLayerIds.size !== 1 ||
          !selectedLayerIds.has(pathEdit.layerId) ||
          !getLayerPath(this.vectorLayer, pathEdit.layerId) ||
          this.isHidden(pathEdit.layerId) ||
          (!preview.isEditing() && !preview.canEditPath(pathEdit.layerId)))
      ) {
        // E.g. another layer was selected in the layer list, undo took the path away, or the time
        // moved into one of its path blocks.
        this.stopPathEdit();
      }
      this.draw();
    });
    // Before the keyboard shortcuts, so that the arrow keys nudge instead of rewinding.
    const removeListeners = [
      on(window, 'keydown', event => this.onKeyDown(event), { capture: true }),
      on(window, 'keyup', event => this.onKeyUp(event), { capture: true }),
      on(window, 'blur', () => this.endNudge()),
    ];
    this.removeKeyListeners = () => removeListeners.forEach(remove => remove());
    this.removeTestHooks = environment.production ? undefined : addTestHooks(preview, this);
  }

  /** Whether a path's points are being edited, for the end-to-end tests. */
  isEditingPath() {
    return !!this.pathEdit;
  }

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    this.renderer.setCamera(camera);
    this.draw();
  }

  onPress(event: PointerEvent, point: Point) {
    this.endNudge();
    const clickCount = this.countClicks(event, point);
    const { pathEdit } = this;
    if (pathEdit && !pathEdit.isOverPath(point)) {
      const hitLayerId = hitTestLayer(this.vectorLayer, point, {
        hiddenLayerIds: this.hiddenLayerIds,
        tolerance: this.camera?.toViewportLength(LAYER_HIT_TOLERANCE) ?? 0,
      })?.id;
      if (
        (hitLayerId && hitLayerId !== pathEdit.layerId) ||
        (!hitLayerId && !pathEdit.getSelectedAnchorIds().size)
      ) {
        // A press on another layer, or on nothing with no points selected, stops editing, like in
        // Sketch, and selects what was pressed.
        this.stopPathEdit();
      }
    }
    this.getTool().onPress(point, getModifiers(event), clickCount);
  }

  onMove(event: PointerEvent, point: Point) {
    this.getTool().onMove(point, getModifiers(event));
  }

  onRelease(_: PointerEvent, point: Point) {
    this.getTool().onRelease(point);
  }

  onLeave() {
    this.getTool().onLeave();
  }

  dispose() {
    this.subscription?.unsubscribe();
    this.removeKeyListeners?.();
    this.nudge = undefined;
    this.pathEdit = undefined;
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

  private getTool() {
    return this.pathEdit ?? this.selectTool;
  }

  /** Returns 2 for the second press of a double-click, and so on. */
  private countClicks(event: PointerEvent, point: Point) {
    const { lastPress, camera } = this;
    const maxDistance = camera ? camera.toViewportLength(DOUBLE_CLICK_DISTANCE) : 0;
    if (
      lastPress &&
      event.timeStamp - lastPress.time < DOUBLE_CLICK_TIME &&
      MathUtil.distance(lastPress.point, point) <= maxDistance
    ) {
      this.lastPress = { time: event.timeStamp, point, count: lastPress.count + 1 };
    } else {
      this.lastPress = { time: event.timeStamp, point, count: 1 };
    }
    return this.lastPress.count;
  }

  /** Starts editing the layer's points, if its path can be edited now, and returns whether it did. */
  private startPathEdit(layerId: string) {
    const { preview, services } = this.context;
    if (
      this.isActionMode ||
      !getLayerPath(this.vectorLayer, layerId) ||
      this.isHidden(layerId) ||
      !preview.canEditPath(layerId)
    ) {
      return false;
    }
    this.endNudge();
    // The next press starts a new click, rather than adding to the double-click that got here.
    this.lastPress = undefined;
    this.selectTool.onLeave();
    services.layerTimelineService.setSelectedLayers(new Set([layerId]));
    this.pathEdit = new PathEditTool({
      layerId,
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      toViewportLength: length => this.camera?.toViewportLength(length) ?? length,
      preview,
      redraw: () => this.draw(),
    });
    this.draw();
    return true;
  }

  /** Whether the layer, or a group it's in, is hidden. */
  private isHidden(layerId: string) {
    for (
      let id: string | undefined = layerId;
      id;
      id = LayerUtil.findParent(this.vectorLayer, id)?.id
    ) {
      if (this.hiddenLayerIds.has(id)) {
        return true;
      }
    }
    return false;
  }

  private stopPathEdit() {
    const { pathEdit } = this;
    if (pathEdit) {
      this.endNudge();
      this.pathEdit = undefined;
      pathEdit.onLeave();
      this.draw();
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.getTool().onModifiersChange(getModifiers(event));
      return undefined;
    }
    const target = event.target instanceof Element ? event.target : undefined;
    if (
      // E.g. Escape, which the canvas took to cancel a drag.
      event.defaultPrevented ||
      this.isActionMode ||
      !this.selectedLayerIds.size ||
      target?.closest('.MuiModal-root') ||
      document.activeElement?.matches('input, textarea, [contenteditable]')
    ) {
      return undefined;
    }
    if (this.pathEdit) {
      return this.onPathEditKeyDown(event, this.pathEdit);
    }
    if (event.key === 'Enter' && !hasModifiers(event) && !isControlFocused()) {
      if (this.context.preview.isEditing() && !this.nudge) {
        // A drag is in progress, which starting to edit would throw away.
        return false;
      }
      const [layerId] = this.selectedLayerIds;
      if (event.repeat || this.selectedLayerIds.size !== 1) {
        return undefined;
      }
      return this.startPathEdit(layerId) ? false : undefined;
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

  private onPathEditKeyDown(event: KeyboardEvent, pathEdit: PathEditTool) {
    const { key } = event;
    const isCommand = ShortcutService.isOsDependentModifierKey(event);
    const arrow = ARROWS[key];
    // The digits' codes, for keyboards like AZERTY that type other characters without Shift.
    const digit = /^Digit[1-4]$/.test(event.code) ? event.code.slice(-1) : key;
    const pointType = /^[1-4]$/.test(digit) ? PathEdit.POINT_TYPES[Number(digit) - 1] : undefined;
    const isHandled =
      (!hasModifiers(event) && (key === 'Escape' || !!pointType)) ||
      (!hasModifiers(event) && key === 'Enter' && !isControlFocused()) ||
      key === 'Backspace' ||
      key === 'Delete' ||
      (key === 'Tab' && !isCommand && !event.altKey && !isControlFocused()) ||
      (!!arrow && !event.altKey && !isCommand && !event.ctrlKey) ||
      (isCommand && (key.toLowerCase() === 'a' || key.toLowerCase() === 'd'));
    if (!isHandled) {
      return undefined;
    }
    if (this.context.preview.isEditing() && !this.nudge) {
      // A drag is in progress.
      return false;
    }
    if (arrow) {
      const distance = event.shiftKey ? BIG_NUDGE : NUDGE;
      this.nudgeBy(arrow[0] * distance, arrow[1] * distance);
      return false;
    }
    if (event.repeat && key !== 'Tab') {
      // Holding Enter would stop and start editing, and holding the others would repeat an edit.
      return false;
    }
    if (key === 'Escape' && this.nudge) {
      // Escape throws a nudge in progress away, rather than committing it.
      this.nudge = undefined;
      this.context.preview.cancel();
    }
    this.endNudge();
    if (key === 'Escape' || key === 'Enter') {
      this.stopPathEdit();
    } else if (key === 'Backspace' || key === 'Delete') {
      if (pathEdit.deleteSelected() === 'empty') {
        // Deleting the points that would leave nothing deletes the layer, like Figma.
        this.stopPathEdit();
        this.context.services.layerTimelineService.deleteSelectedModels();
      }
    } else if (key === 'Tab') {
      pathEdit.selectAdjacent(event.shiftKey ? -1 : 1);
    } else if (pointType) {
      pathEdit.setPointType(pointType);
    } else if (key.toLowerCase() === 'a') {
      pathEdit.selectAll();
    }
    // Cmd+D does nothing while points are edited, rather than bookmarking the page.
    return false;
  }

  private onKeyUp(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.getTool().onModifiersChange(getModifiers(event));
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
      const apply = base && this.getNudge(base);
      if (!apply) {
        // E.g. an empty vector layer, or no points, are selected.
        preview.cancel();
        return;
      }
      this.nudge = { apply, x: 0, y: 0 };
    }
    const nudge = this.nudge;
    nudge.x += dx;
    nudge.y += dy;
    nudge.apply(nudge.x, nudge.y);
  }

  /** Returns what moves the selected points, or else the selected layers, by a distance. */
  private getNudge(base: CanvasDocument) {
    const { preview } = this.context;
    const { pathEdit } = this;
    if (pathEdit) {
      const move = pathEdit.getPointsMove(base);
      return move && ((x: number, y: number) => preview.setPath(pathEdit.layerId, move.move(x, y)));
    }
    const layerIds = getTopmostLayerIds(base.vectorLayer, this.selectedLayerIds);
    if (!layerIds.length) {
      return undefined;
    }
    const rendered = this.render(base);
    return (x: number, y: number) =>
      preview.setDocument(translateLayers(base, rendered, layerIds, x, y));
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
    const pathEdit = this.pathEdit?.getDrawing();
    this.renderer.draw(camera, {
      vectorLayer: this.vectorLayer,
      hoveredLayerId: pathEdit ? undefined : this.selectTool.getHoveredLayerId(),
      selectedLayerIds: this.selectedLayerIds,
      isShowingHandles: this.selectTool.isShowingHandles(),
      marquee: pathEdit ? pathEdit.marquee : this.selectTool.getMarquee(),
      guides: pathEdit ? pathEdit.guides : this.selectTool.getGuides(),
      pathEdit,
    });
    // The panel's styles turn this into a cursor (components/canvas/canvas.scss).
    const cursor = this.pathEdit ? undefined : this.selectTool.getCursor();
    if (cursor) {
      this.context.root.dataset.editorCursor = cursor;
    } else {
      delete this.context.root.dataset.editorCursor;
    }
  }
}

/** Whether a control that Enter and Tab work in has the focus, e.g. a button. */
function isControlFocused() {
  return !!document.activeElement?.matches(
    'button, a, select, [role="button"], [role="menuitem"], [role="tab"]',
  );
}

function hasModifiers(event: KeyboardEvent) {
  return event.shiftKey || event.altKey || event.metaKey || event.ctrlKey;
}

function getModifiers(event: MouseEvent | KeyboardEvent): Modifiers {
  return {
    shift: event.shiftKey,
    alt: event.altKey,
    command: ShortcutService.isOsDependentModifierKey(event),
    ctrl: event.ctrlKey,
  };
}

function addTestHooks(preview: CanvasPreview, editor: { isEditingPath(): boolean }) {
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
    isEditingPath: () => editor.isEditingPath(),
  };
  return () => {
    delete devGlobal.canvasEditor;
  };
}
