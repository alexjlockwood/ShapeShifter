import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import type {
  CanvasEditor,
  CanvasEditorCommand,
  CanvasEditorCommands,
  CanvasEditorContext,
  CanvasEditorMenuState,
  PointCommand,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import type { CanvasPreview } from 'app/modules/editor/components/canvas/CanvasPreview';
import { getRulerLayout } from 'app/modules/editor/components/canvas/CanvasRuler';
import {
  autoFixPathBlocks,
  getPathKeyframe,
} from 'app/modules/editor/components/canvas/pathKeyframes';
import { getLayersBounds, hitTestLayer } from 'app/modules/editor/components/canvas/LayerGeometry';
import {
  duplicateLayers,
  getTopmostLayerIds,
  translateLayers,
} from 'app/modules/editor/components/canvas/transformLayers';
import type { Guide } from 'app/modules/editor/model/guides';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import {
  getBooleanLayerIds,
  getOutlineLayerIds,
} from 'app/modules/editor/scripts/common/pathOpLayers';
import { on } from 'app/modules/editor/scripts/dom';
import type { CanvasSettings } from 'app/modules/editor/services/canvassettings.service';
import {
  isSelectAllShortcut,
  ShortcutService,
  TEXT_FIELD_SELECTOR,
} from 'app/modules/editor/services/shortcut.service';
import { Duration } from 'app/modules/editor/services/snackbar.service';
import { isActionMode } from 'app/modules/editor/store/actionmode/selectors';
import { getGuides } from 'app/modules/editor/store/guides/selectors';
import { getHiddenLayerIds, getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import {
  getAnimatedVectorLayer,
  getCurrentTime,
  getIsPlaying,
} from 'app/modules/editor/store/playback/selectors';
import { environment } from 'environments/environment';
import { combineLatest, Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

import type { DrawToolContext } from './drawTools';
import { EditorRenderer } from './EditorRenderer';
import { EditorToolbar, ToolName } from './EditorToolbar';
import { GuideTool } from './GuideTool';
import { getKeyframeStatus, KeyframeBadge } from './KeyframeBadge';
import { getMeasurements } from './measuring';
import { combinePaths, loadPathKit, outlineStrokes } from './pathOps';
import {
  AvailablePathOps,
  getPathOpShortcut,
  NO_PATH_OPS,
  PathOpName,
  PathOpsBar,
} from './PathOpsBar';
import { getLayerPath, PathEditTool } from './PathEditTool';
import { PencilTool } from './PencilTool';
import { applyPointCommand, getPointMenuState } from './pointCommands';
import { PenTool } from './PenTool';
import { ShapeTool } from './ShapeTool';
import { Modifiers, SelectTool } from './SelectTool';
import type { SnapThresholds } from './snapping';

// The property inspector shows it for paths when the editor is on (CanvasEditorApi.ts).
export { PathInspector } from './PathInspector';

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

// How close to a layer's outline a press hits it, and how close things snap, in CSS pixels, as in
// SelectTool.
const LAYER_HIT_TOLERANCE = 6;
const SNAP_THRESHOLD = 8;
const GRID_SNAP_THRESHOLD = 4;
// Presses closer together than this, in milliseconds and CSS pixels, are a double-click.
const DOUBLE_CLICK_TIME = 500;
const DOUBLE_CLICK_DISTANCE = 4;
// Fingers are less precise than a mouse, so tolerances are this much bigger for them.
const TOUCH_TOLERANCE_SCALE = 2;

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
  private guides: ReadonlyArray<Guide> = [];
  private settings: CanvasSettings;
  private readonly renderer: EditorRenderer;
  private readonly selectTool: SelectTool;
  // Drags the guides, before the other tools get the pointer.
  private readonly guideTool: GuideTool;
  // Where the pointer last hovered, and whether Alt is held there, to measure distances.
  private hoverPoint: Point | undefined;
  private isAltHeld = false;
  private isOverRuler = false;
  // Scales the tolerances for the kind of pointer in use.
  private toleranceScale = 1;
  // The path whose points are being edited, if any. The select tool is used otherwise.
  private pathEdit: PathEditTool | undefined;
  // The drawing tool picked in the toolbar, which gets the pointer before the others.
  private drawTool: PenTool | PencilTool | ShapeTool | undefined;
  private toolName: ToolName = 'select';
  private toolbar: EditorToolbar | undefined;
  // Says whether the selected path still morphs while it's edited at a keyframe.
  private keyframeBadge: KeyframeBadge | undefined;
  // Combines the selected paths and outlines their strokes.
  private pathOpsBar: PathOpsBar | undefined;
  // What getAvailablePathOps worked out last, and from what.
  private availablePathOps:
    | {
        readonly document: CanvasDocument;
        readonly selectedLayerIds: ReadonlySet<string>;
        readonly available: AvailablePathOps;
      }
    | undefined;
  private isDisposed = false;
  // Whether the pointer is pressed, so that tools don't change in the middle of a gesture.
  private isPressing = false;
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
    this.settings = services.canvasSettingsService.getSettings();
    this.guideTool = new GuideTool({
      getGuides: () => this.getVisibleGuides(),
      setGuides: guides => services.guideService.setGuides(guides),
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      toViewportLength: length => this.toViewportLength(length),
      getSnapThresholds: () => this.getSnapThresholds(),
      isRemoving: (axis, point) => this.isRemovingGuide(axis, point),
      redraw: () => this.draw(),
    });
    this.selectTool = new SelectTool({
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      getSelectedLayerIds: () => this.selectedLayerIds,
      setSelectedLayerIds: layerIds =>
        services.layerTimelineService.setSelectedLayers(new Set(layerIds)),
      toViewportLength: length => this.toViewportLength(length),
      render: document => this.render(document),
      preview,
      redraw: () => this.draw(),
      editPath: layerId => this.startPathEdit(layerId),
      getSnapThresholds: () => this.getSnapThresholds(),
      getGuides: () => this.getVisibleGuides(),
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
      store.select(getIsPlaying),
    ]).subscribe(([{ vl, currentTime }, , hiddenLayerIds, selectedLayerIds, actionMode]) => {
      this.vectorLayer = preview.apply(vl, currentTime);
      this.hiddenLayerIds = hiddenLayerIds;
      this.selectedLayerIds = selectedLayerIds;
      if (actionMode && !this.isActionMode) {
        // Without cleaning up after the pen, which would change the selection that action mode
        // is opening for.
        this.setTool('select', { finishPen: false });
        this.selectTool.onLeave();
      }
      if (actionMode !== this.isActionMode) {
        this.toolbar?.setHidden(actionMode);
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
      // Here rather than in draw, since it only changes with the document, the time, and the
      // selection, and drawing happens on every hover too.
      this.keyframeBadge?.show(this.getKeyframeStatus());
      this.draw();
    });
    this.subscription.add(
      store.select(getGuides).subscribe(guides => {
        this.guides = guides;
        this.draw();
      }),
    );
    this.subscription.add(
      this.context.services.canvasSettingsService.asObservable().subscribe(settings => {
        this.settings = settings;
        this.toolbar?.setSettings(settings);
        if (!settings.showRulers) {
          // The guides are hidden with the rulers.
          this.guideTool.onLeave();
        }
        this.draw();
      }),
    );
    // Before the keyboard shortcuts, so that the arrow keys nudge instead of rewinding.
    const removeListeners = [
      on(window, 'keydown', event => this.onKeyDown(event), { capture: true }),
      on(window, 'keyup', event => this.onKeyUp(event), { capture: true }),
      on(window, 'blur', () => {
        this.endNudge();
        this.setAltHeld(false);
      }),
    ];
    this.removeKeyListeners = () => removeListeners.forEach(remove => remove());
    this.toolbar = new EditorToolbar(this.context.root, {
      onSelect: tool => this.setTool(tool),
      onToggle: setting => this.context.services.canvasSettingsService.toggle(setting),
      // The pointer is over the toolbar, rather than over what's under it.
      onHover: () => {
        if (!this.isPressing) {
          this.getTool().onLeave();
        }
      },
    });
    this.toolbar.setHidden(this.isActionMode);
    this.toolbar.setSettings(this.settings);
    const { actionModeService, playbackService } = this.context.services;
    this.keyframeBadge = new KeyframeBadge(this.context.root, {
      onAutoFix: blockIds => this.autoFix(blockIds),
      onEditMorph: blockId => actionModeService.editMorph(blockId),
      onSeek: time => playbackService.setCurrentTime(time),
    });
    this.pathOpsBar = new PathOpsBar(this.context.root, op => void this.runPathOp(op));
    this.removeTestHooks = environment.production ? undefined : addTestHooks(preview, this);
  }

  /** Whether a path's points are being edited, for the end-to-end tests. */
  isEditingPath() {
    return !!this.pathEdit;
  }

  /** The tool picked in the toolbar, for the end-to-end tests. */
  getToolName() {
    return this.toolName;
  }

  setCamera(camera: CanvasCamera) {
    this.camera = camera;
    this.renderer.setCamera(camera);
    this.draw();
  }

  onPress(event: PointerEvent, point: Point) {
    this.toleranceScale = event.pointerType === 'touch' ? TOUCH_TOLERANCE_SCALE : 1;
    this.isPressing = true;
    this.endNudge();
    const ruler = getRuler(event);
    if (ruler) {
      // Dragging out of a ruler adds a guide, whatever the tool.
      this.guideTool.setHoveredGuide(undefined);
      if (ruler !== 'corner' && this.showsGuides()) {
        this.getTool().onLeave();
        this.guideTool.startNew(ruler === 'horizontal' ? 'y' : 'x', point, getModifiers(event));
      }
      return;
    }
    const guide = this.getGuideAt(point);
    if (guide) {
      this.guideTool.startMove(guide, point);
      return;
    }
    const clickCount = this.countClicks(event, point);
    const { pathEdit } = this;
    if (pathEdit && !this.drawTool && !pathEdit.isOverPath(point)) {
      const hitLayerId = hitTestLayer(this.vectorLayer, point, {
        hiddenLayerIds: this.hiddenLayerIds,
        tolerance: this.toViewportLength(LAYER_HIT_TOLERANCE),
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
    if (!this.isPressing) {
      this.toleranceScale = event.pointerType === 'touch' ? TOUCH_TOLERANCE_SCALE : 1;
    }
    this.hoverPoint = point;
    this.setAltHeld(event.altKey);
    const { lastPress } = this;
    if (
      this.isPressing &&
      lastPress &&
      MathUtil.distance(lastPress.point, point) > this.toViewportLength(DOUBLE_CLICK_DISTANCE)
    ) {
      // A press that became a drag isn't a click, so the next press starts counting again.
      this.lastPress = undefined;
    }
    if (this.guideTool.isDragging()) {
      this.guideTool.onMove(point, getModifiers(event));
      return;
    }
    if (this.isPressing) {
      this.getTool().onMove(point, getModifiers(event));
      return;
    }
    const isOverRuler = !!getRuler(event);
    if (isOverRuler !== this.isOverRuler) {
      this.isOverRuler = isOverRuler;
      this.draw();
    }
    if (isOverRuler) {
      // The ruler is over the canvas, so nothing under it is hovered.
      this.guideTool.setHoveredGuide(undefined);
      this.getTool().onLeave();
      return;
    }
    const guide = this.getGuideAt(point);
    this.guideTool.setHoveredGuide(guide);
    if (guide) {
      this.selectTool.onLeave();
      return;
    }
    this.getTool().onMove(point, getModifiers(event));
  }

  onRelease(_: PointerEvent, point: Point) {
    this.isPressing = false;
    if (this.guideTool.isDragging()) {
      this.guideTool.onRelease();
    } else {
      this.getTool().onRelease(point);
    }
    // A finger doesn't hover, so what comes next, like the keyboard, uses the mouse's tolerances.
    this.toleranceScale = 1;
  }

  onLeave() {
    this.isPressing = false;
    this.toleranceScale = 1;
    this.hoverPoint = undefined;
    this.isOverRuler = false;
    this.guideTool.onLeave();
    this.getTool().onLeave();
  }

  /** The guides, unless they're hidden with the rulers, or in action mode. */
  private getVisibleGuides() {
    return this.showsGuides() ? this.guides : [];
  }

  private showsGuides() {
    return this.settings.showRulers && !this.isActionMode;
  }

  /**
   * Returns the guide under the point that a press would drag. The guides are only for the select
   * tool, and the selection's handles win over them.
   */
  private getGuideAt(point: Point) {
    if (
      !this.showsGuides() ||
      this.drawTool ||
      this.pathEdit ||
      this.selectTool.isOverHandle(point)
    ) {
      return undefined;
    }
    return this.guideTool.hitTest(point);
  }

  /** Whether a guide dragged to the point is dropped on its ruler, or off of the panel. */
  private isRemovingGuide(axis: Guide['axis'], point: Point) {
    const { camera } = this;
    if (!camera) {
      return false;
    }
    const { x, y } = camera.viewportToPanel(point);
    if (x < 0 || y < 0 || x > camera.panel.w || y > camera.panel.h) {
      return true;
    }
    const { rect } = getRulerLayout(camera, axis === 'x' ? 'vertical' : 'horizontal');
    return axis === 'x' ? x <= rect.x + rect.w : y <= rect.y + rect.h;
  }

  /** A tolerance in CSS pixels in viewport units, bigger for touches. */
  private toViewportLength(length: number) {
    const scaled = length * this.toleranceScale;
    return this.camera?.toViewportLength(scaled) ?? scaled;
  }

  /** How close things snap, with the pixel grid left out if its snapping is off. */
  private getSnapThresholds(): SnapThresholds {
    return {
      lines: this.toViewportLength(SNAP_THRESHOLD),
      grid: this.settings.snapToPixelGrid ? this.toViewportLength(GRID_SNAP_THRESHOLD) : 0,
    };
  }

  private setAltHeld(isAltHeld: boolean) {
    if (this.isAltHeld !== isAltHeld) {
      this.isAltHeld = isAltHeld;
      this.draw();
    }
  }

  /**
   * The distances from the selection to the path under the pointer, or else to the artboard, while
   * Alt is held, as in Figma.
   */
  private getMeasurements() {
    const { vectorLayer: vl, selectedLayerIds, hoverPoint } = this;
    if (
      !this.isAltHeld ||
      this.isPressing ||
      this.isOverRuler ||
      !hoverPoint ||
      this.drawTool ||
      this.pathEdit ||
      this.guideTool.isDragging() ||
      !selectedLayerIds.size
    ) {
      return undefined;
    }
    const selection = getLayersBounds(vl, selectedLayerIds);
    if (!selection) {
      return undefined;
    }
    const hoveredLayerId = this.selectTool.getHoveredLayerId();
    const hovered =
      hoveredLayerId && !selectedLayerIds.has(hoveredLayerId)
        ? getLayersBounds(vl, [hoveredLayerId])
        : undefined;
    const target = hovered ?? { l: 0, t: 0, r: vl.width, b: vl.height };
    return { target, items: getMeasurements(selection, target) };
  }

  dispose() {
    this.subscription?.unsubscribe();
    this.removeKeyListeners?.();
    this.nudge = undefined;
    this.pathEdit = undefined;
    this.reportPointEdit();
    this.drawTool = undefined;
    this.toolbar?.dispose();
    this.keyframeBadge?.dispose();
    this.pathOpsBar?.dispose();
    this.isDisposed = true;
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
    return this.drawTool ?? this.pathEdit ?? this.selectTool;
  }

  /**
   * Switches tools, finishing the path the pen was drawing. The shapes and the pencil draw new
   * layers, so they stop editing points, but the pen adds subpaths to the path being edited.
   */
  private setTool(name: ToolName, { finishPen = true } = {}) {
    if (this.isActionMode && name !== 'select') {
      return;
    }
    const { drawTool } = this;
    this.drawTool = undefined;
    drawTool?.onLeave();
    if (drawTool instanceof PenTool && finishPen) {
      drawTool.finish();
    }
    this.endNudge();
    this.selectTool.onLeave();
    this.pathEdit?.onLeave();
    if (name !== 'select' && name !== 'pen') {
      this.stopPathEdit();
    }
    this.toolName = name;
    this.drawTool = this.createDrawTool(name);
    this.toolbar?.setActiveTool(name);
    this.draw();
  }

  private createDrawTool(name: ToolName) {
    const context: DrawToolContext = {
      getVectorLayer: () => this.vectorLayer,
      getHiddenLayerIds: () => this.hiddenLayerIds,
      getSelectedLayerIds: () => this.selectedLayerIds,
      toViewportLength: length => this.toViewportLength(length),
      getSnapThresholds: () => this.getSnapThresholds(),
      getGuides: () => this.getVisibleGuides(),
      render: document => this.render(document),
      canEditPath: layerId => this.context.preview.canEditPath(layerId),
      preview: this.context.preview,
      redraw: () => this.draw(),
      // Back to the select tool, or to editing points if the pen was adding to a path.
      finish: () => this.setTool('select'),
    };
    switch (name) {
      case 'select':
        return undefined;
      case 'pen':
        return new PenTool({ ...context, targetLayerId: this.pathEdit?.layerId });
      case 'pencil':
        // Its lengths are how closely it follows the pointer, rather than tolerances, so they're
        // the same for fingers.
        return new PencilTool({
          ...context,
          toViewportLength: length => this.camera?.toViewportLength(length) ?? length,
        });
      default:
        return new ShapeTool(name, context);
    }
  }

  /** Returns 2 for the second press of a double-click, and so on. */
  private countClicks(event: PointerEvent, point: Point) {
    const { lastPress } = this;
    const maxDistance = this.toViewportLength(DOUBLE_CLICK_DISTANCE);
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
      toViewportLength: length => this.toViewportLength(length),
      preview,
      redraw: () => this.draw(),
      getSnapThresholds: () => this.getSnapThresholds(),
      getGuides: () => this.getVisibleGuides(),
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
      if (this.drawTool instanceof PenTool && this.drawTool.targetLayerId) {
        // It was adding to the path.
        this.setTool('select');
      }
      this.draw();
    }
  }

  private onKeyDown(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.setAltHeld(event.altKey);
      this.guideTool.onModifiersChange(getModifiers(event));
      this.getTool().onModifiersChange(getModifiers(event));
      return undefined;
    }
    const target = event.target instanceof Element ? event.target : undefined;
    if (
      // E.g. Escape, which the canvas took to cancel a drag.
      event.defaultPrevented ||
      this.isActionMode ||
      target?.closest('.MuiModal-root')
    ) {
      return undefined;
    }
    if (isSelectAllShortcut(event, ShortcutService.isMac())) {
      // Even with the focus on a toolbar button or a checkbox, since the shortcut service would
      // select every layer instead, with the pen still drawing or the path edit stopped by the new
      // selection. Text fields keep the browser's select all.
      return document.activeElement?.matches(TEXT_FIELD_SELECTOR)
        ? undefined
        : this.selectAll(event);
    }
    if (
      // The toolbar's buttons handle their own keys.
      target?.closest('.canvas-editor-toolbar') ||
      document.activeElement?.matches('input, textarea, [contenteditable]')
    ) {
      return undefined;
    }
    const pathOp = getPathOpShortcut(event);
    if (pathOp && !this.drawTool && !this.pathEdit) {
      if (!event.repeat && !this.isPressing) {
        void this.runPathOp(pathOp);
      }
      return false;
    }
    const setting = getSettingShortcut(event);
    if (setting) {
      if (!event.repeat) {
        this.context.services.canvasSettingsService.toggle(setting);
      }
      return false;
    }
    const tool = getToolShortcut(event);
    if (tool) {
      // Not in the middle of a gesture, which the new tool couldn't finish.
      if (!event.repeat && !this.isPressing) {
        this.setTool(tool);
      }
      return false;
    }
    const { drawTool } = this;
    if (
      drawTool instanceof PenTool &&
      (event.key === 'Backspace' || event.key === 'Delete') &&
      drawTool.isDrawing()
    ) {
      // Rather than deleting the layer, like Figma.
      if (!this.isPressing) {
        drawTool.removeLastPoint();
      }
      return false;
    }
    if (
      this.drawTool &&
      !hasModifiers(event) &&
      (event.key === 'Escape' || (event.key === 'Enter' && !isControlFocused()))
    ) {
      if (this.isPressing || (this.context.preview.isEditing() && !this.nudge)) {
        // A drag is in progress.
        return false;
      }
      // Finishes the pen's path, and goes back to the select tool.
      this.setTool('select');
      return false;
    }
    if (this.pathEdit) {
      return this.onPathEditKeyDown(event, this.pathEdit);
    }
    if (!this.selectedLayerIds.size) {
      // The rest act on the selection.
      return undefined;
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
    // It keeps the browser from bookmarking the page too.
    this.duplicateSelection();
    return false;
  }

  /** Duplicates the selected layers in place, and selects the copies. */
  private duplicateSelection() {
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
  }

  getLayerAt(point: Point) {
    if (this.isActionMode || this.getMenuState().busyReason) {
      return undefined;
    }
    return hitTestLayer(this.vectorLayer, point, {
      hiddenLayerIds: this.hiddenLayerIds,
      tolerance: this.toViewportLength(LAYER_HIT_TOLERANCE),
    })?.id;
  }

  getMenuState(): CanvasEditorMenuState {
    const { drawTool } = this;
    // E.g. the pen drawing a path, which a new selection or edit would throw away. The right-click
    // has already canceled drags.
    const isBusy = this.isPressing || (this.context.preview.isEditing() && !this.nudge);
    const busyReason = !isBusy
      ? undefined
      : drawTool instanceof PenTool
        ? "Finish the path you're drawing first"
        : 'Finish editing first';
    const { pathEdit } = this;
    const path = pathEdit?.getDrawnPath();
    return {
      busyReason,
      editingLayerId: pathEdit?.layerId,
      points:
        pathEdit && path && !busyReason
          ? getPointMenuState(path, pathEdit.getSelectedAnchorIds())
          : undefined,
    };
  }

  startPointEdit(layerId: string) {
    if (this.isDisposed || this.getMenuState().busyReason) {
      return false;
    }
    if (this.pathEdit?.layerId === layerId) {
      return true;
    }
    if (this.drawTool) {
      // As if V was pressed first, which also finishes the pen's path.
      this.setTool('select');
    }
    return this.startPathEdit(layerId);
  }

  stopPointEdit() {
    this.endNudge();
    this.stopPathEdit();
  }

  setSelectedAnchorIds(layerId: string, anchorIds: ReadonlySet<string>) {
    if (this.pathEdit?.layerId === layerId && !this.isPressing) {
      this.pathEdit.setSelectedAnchorIds(anchorIds);
    }
  }

  editPoints(layerId: string, edit: Parameters<CanvasEditorCommands['editPoints']>[1]) {
    const { pathEdit } = this;
    if (pathEdit?.layerId !== layerId || this.getMenuState().busyReason) {
      return;
    }
    this.endNudge();
    pathEdit.edit(edit);
  }

  runPointCommand(command: PointCommand) {
    const { pathEdit } = this;
    if (!pathEdit || this.getMenuState().busyReason) {
      return;
    }
    this.endNudge();
    if (command.type === 'delete') {
      this.deleteSelectedPoints(pathEdit);
      return;
    }
    pathEdit.edit(
      base => applyPointCommand(base, pathEdit.getSelectedAnchorIds(), command) ?? { path: base },
    );
  }

  selectPointAt(point: Point) {
    if (this.pathEdit && !this.getMenuState().busyReason) {
      this.pathEdit.selectAnchorAt(point);
    }
  }

  /** Deletes the selected points, or the layer if that would leave nothing, like Figma. */
  private deleteSelectedPoints(pathEdit: PathEditTool) {
    if (pathEdit.deleteSelected() === 'empty') {
      this.stopPathEdit();
      this.context.services.layerTimelineService.deleteSelectedModels();
    }
  }

  /**
   * Tells the property inspector which path's points are edited, and which are selected
   * (services/canvaseditorbridge.service.ts). It's called on every draw, which follows every
   * change to either, and the bridge ignores reports that change nothing.
   */
  private reportPointEdit() {
    const { pathEdit } = this;
    const path = pathEdit?.getDrawnPath();
    this.context.services.canvasEditorBridgeService.reportPointEdit(
      this,
      pathEdit && path && !this.isActionMode
        ? { layerId: pathEdit.layerId, path, selectedAnchorIds: pathEdit.getSelectedAnchorIds() }
        : undefined,
    );
  }

  runCommand(command: CanvasEditorCommand) {
    if (this.isDisposed || this.isActionMode || this.getMenuState().busyReason) {
      return;
    }
    this.endNudge();
    // As if Enter or V was pressed first.
    this.stopPathEdit();
    if (this.drawTool) {
      this.setTool('select');
    }
    if (command === 'duplicate') {
      this.duplicateSelection();
    } else {
      void this.runPathOp(command);
    }
  }

  /**
   * Selects every point of the path being edited, or else every visible layer, like Figma, rather
   * than the page's text. Not in the middle of a gesture, which the new selection would cancel, or
   * on key repeat.
   */
  private selectAll(event: KeyboardEvent) {
    if (event.repeat || this.isPressing || (this.context.preview.isEditing() && !this.nudge)) {
      return false;
    }
    this.endNudge();
    if (this.pathEdit) {
      this.pathEdit.selectAll();
      return false;
    }
    if (this.drawTool) {
      // As if V was pressed first, which also finishes the pen's path.
      this.setTool('select');
    }
    this.context.services.layerTimelineService.selectAllLayers();
    return false;
  }

  /** Auto fixes the blocks, and the rest of the chain of morphs they're in, as one undo step. */
  private autoFix(blockIds: ReadonlyArray<string>) {
    this.endNudge();
    const { preview, services } = this.context;
    preview.begin();
    const base = preview.getBase();
    if (!base) {
      return;
    }
    try {
      preview.setDocument(autoFixPathBlocks(base, new Set(blockIds)));
    } catch (e) {
      preview.cancel();
      bugsnagClient.notify(e instanceof Error ? e : String(e));
      services.snackBarService.show("Couldn't auto fix these paths", 'Dismiss', Duration.Long);
      return;
    }
    preview.commit();
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
      (isCommand && ['d', 'j'].includes(key.toLowerCase()));
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
      this.deleteSelectedPoints(pathEdit);
    } else if (key === 'Tab') {
      pathEdit.selectAdjacent(event.shiftKey ? -1 : 1);
    } else if (pointType) {
      pathEdit.setPointType(pointType);
    } else if (key.toLowerCase() === 'j') {
      // Rather than opening the browser's downloads.
      pathEdit.joinSelected();
    }
    // Cmd+D does nothing while points are edited, rather than bookmarking the page.
    return false;
  }

  private onKeyUp(event: KeyboardEvent) {
    if (MODIFIER_KEYS.has(event.key)) {
      this.setAltHeld(event.altKey);
      this.guideTool.onModifiersChange(getModifiers(event));
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
      const move = pathEdit.getPointsMove();
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
    this.reportPointEdit();
    const { camera } = this;
    if (!camera) {
      return;
    }
    if (this.isActionMode) {
      // Action mode has its own selections, drawn by the canvases.
      this.renderer.clear();
      this.pathOpsBar?.setAvailable(NO_PATH_OPS);
      delete this.context.root.dataset.editorCursor;
      return;
    }
    this.pathOpsBar?.setAvailable(this.getAvailablePathOps());
    const { drawTool } = this;
    const pathEdit = this.pathEdit?.getDrawing();
    const overlay = drawTool?.getOverlay();
    const isSelecting = !pathEdit && !drawTool;
    this.renderer.draw(camera, {
      vectorLayer: this.vectorLayer,
      hoveredLayerId: isSelecting ? this.selectTool.getHoveredLayerId() : undefined,
      selectedLayerIds: this.selectedLayerIds,
      // The handles are in the way of drawing.
      isShowingHandles: !drawTool && this.selectTool.isShowingHandles(),
      marquee: pathEdit ? pathEdit.marquee : isSelecting ? this.selectTool.getMarquee() : undefined,
      guides: overlay?.guides ?? pathEdit?.guides ?? this.selectTool.getGuides(),
      pathEdit,
      overlay,
      rulerGuides: this.showsGuides() ? this.guideTool.getDrawing() : undefined,
      measurements: this.getMeasurements(),
      showsPixelGrid: this.settings.showPixelGrid,
    });
    // The panel's styles turn this into a cursor (components/canvas/canvas.scss). The rulers have
    // their own.
    const cursor = this.isOverRuler
      ? undefined
      : (this.guideTool.getCursor() ?? this.getToolCursor());
    if (cursor) {
      this.context.root.dataset.editorCursor = cursor;
    } else {
      delete this.context.root.dataset.editorCursor;
    }
  }

  /**
   * Which path operations apply to the selection, with the select tool. It's drawn on every hover,
   * so this only works it out again when the document or the selection changes.
   */
  private getAvailablePathOps(): AvailablePathOps {
    if (this.drawTool || this.pathEdit || !this.selectedLayerIds.size) {
      return NO_PATH_OPS;
    }
    const document = this.context.preview.getStoreDocument();
    const cached = this.availablePathOps;
    if (
      cached?.document.vectorLayer === document.vectorLayer &&
      cached.document.animation === document.animation &&
      cached.selectedLayerIds === this.selectedLayerIds
    ) {
      return cached.available;
    }
    const available = {
      booleans: !!getBooleanLayerIds(document, this.selectedLayerIds),
      outline: !!getOutlineLayerIds(document, this.selectedLayerIds),
    };
    this.availablePathOps = { document, selectedLayerIds: this.selectedLayerIds, available };
    return available;
  }

  /**
   * Combines the selected paths, or outlines their strokes, as one undo step. PathKit is
   * downloaded the first time, so it happens once that's done, to the selection at that point.
   */
  private async runPathOp(op: PathOpName) {
    const { snackBarService, layerTimelineService } = this.context.services;
    let pk: Awaited<ReturnType<typeof loadPathKit>>;
    try {
      pk = await loadPathKit();
    } catch (error) {
      // E.g. offline, before it was ever loaded.
      bugsnagClient.notify(error instanceof Error ? error : String(error), { severity: 'info' });
      snackBarService.show(
        "Couldn't load the path operations. Try again once you're online.",
        'Dismiss',
        Duration.Long,
      );
      return;
    }
    if (this.isDisposed || this.isActionMode || this.drawTool || this.pathEdit) {
      return;
    }
    this.endNudge();
    const document = this.context.preview.getStoreDocument();
    const selected = this.selectedLayerIds;
    try {
      if (op === 'outline') {
        const layerIds = getOutlineLayerIds(document, selected);
        if (layerIds) {
          const outlined = outlineStrokes(pk, document, layerIds);
          layerTimelineService.commitCanvasEdit(
            outlined.document.vectorLayer,
            outlined.document.animation,
            { selectedLayerIds: new Set(outlined.layerIds) },
          );
        }
        return;
      }
      const layerIds = getBooleanLayerIds(document, selected);
      if (!layerIds) {
        return;
      }
      const combined = combinePaths(pk, document, layerIds, op);
      if (!combined) {
        snackBarService.show(
          "The paths don't overlap, so nothing's left",
          'Dismiss',
          Duration.Short,
        );
        return;
      }
      layerTimelineService.commitCanvasEdit(
        combined.document.vectorLayer,
        combined.document.animation,
        { selectedLayerIds: new Set([combined.layerId]) },
      );
    } catch (error) {
      bugsnagClient.notify(error instanceof Error ? error : String(error));
      snackBarService.show("Couldn't change these paths", 'Dismiss', Duration.Long);
    }
  }

  /** What the badge says about the one path that's selected, which is the one being edited. */
  private getKeyframeStatus() {
    const { store, preview } = this.context;
    const state = store.getState();
    const [layerId] = this.selectedLayerIds;
    if (this.isActionMode || this.selectedLayerIds.size !== 1 || getIsPlaying(state)) {
      return undefined;
    }
    const time = getCurrentTime(state);
    return getKeyframeStatus(getPathKeyframe(preview.getDocument(), layerId, time), time);
  }

  private getToolCursor() {
    const { drawTool } = this;
    return drawTool instanceof PenTool
      ? drawTool.getCursor()
      : drawTool instanceof PencilTool
        ? 'pencil'
        : drawTool
          ? 'crosshair'
          : this.pathEdit
            ? undefined
            : this.selectTool.getCursor();
  }
}

/**
 * Returns the tool that the key picks, as in Figma: V, P, Shift+P, R, O, and L. They only work with
 * the canvas editor on, and outside of action mode, so R still toggles repeating otherwise.
 */
function getToolShortcut(event: KeyboardEvent): ToolName | undefined {
  if (event.altKey || event.metaKey || event.ctrlKey) {
    return undefined;
  }
  const key = getLetter(event);
  if (key === 'p') {
    return event.shiftKey ? 'pencil' : 'pen';
  }
  if (event.shiftKey) {
    // E.g. Shift+R, which is for the rulers (getSettingShortcut).
    return undefined;
  }
  const tools: Record<string, ToolName> = {
    v: 'select',
    r: 'rectangle',
    o: 'ellipse',
    l: 'line',
  };
  return tools[key];
}

/**
 * Returns the setting that the key toggles, as in Figma: Shift+R for the rulers, Shift+' for the
 * pixel grid, and Cmd+Shift+' (Ctrl+Shift+' outside of Macs) for snapping to it.
 */
function getSettingShortcut(event: KeyboardEvent): keyof CanvasSettings | undefined {
  if (!event.shiftKey || event.altKey) {
    return undefined;
  }
  const isCommand = ShortcutService.isOsDependentModifierKey(event);
  // The other of Cmd and Ctrl isn't part of any of them.
  const hasOtherModifier = ShortcutService.isMac() ? event.ctrlKey : event.metaKey;
  if (hasOtherModifier) {
    return undefined;
  }
  if (event.code === 'Quote') {
    return isCommand ? 'snapToPixelGrid' : 'showPixelGrid';
  }
  return !isCommand && getLetter(event) === 'r' ? 'showRulers' : undefined;
}

/**
 * Returns the letter key that was pressed, in lower case. It goes by the key's position on
 * layouts without Latin letters, e.g. Cyrillic, like the app's other shortcuts, which use keyCode.
 */
function getLetter(event: KeyboardEvent) {
  return /^[a-z]$/i.test(event.key)
    ? event.key.toLowerCase()
    : /^Key[A-Z]$/.test(event.code)
      ? event.code.slice(3).toLowerCase()
      : '';
}

/** Returns the ruler that the pointer event is over, if any. */
function getRuler(event: PointerEvent) {
  const ruler = event.target instanceof Element ? event.target.closest('.canvas-ruler') : null;
  if (!ruler) {
    return undefined;
  }
  return ruler.classList.contains('orientation-horizontal')
    ? 'horizontal'
    : ruler.classList.contains('orientation-vertical')
      ? 'vertical'
      : 'corner';
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

function addTestHooks(
  preview: CanvasPreview,
  editor: { isEditingPath(): boolean; getToolName(): ToolName },
) {
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
    getToolName: () => editor.getToolName(),
  };
  return () => {
    delete devGlobal.canvasEditor;
  };
}
