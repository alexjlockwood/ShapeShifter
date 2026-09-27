import type {
  CanvasDocument,
  CanvasEditLayerIds,
} from 'app/modules/editor/components/canvas/CanvasPreview';
import {
  getLayersBounds,
  getPathLayerBounds,
  hitTestLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import type { Guide } from 'app/modules/editor/model/guides';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { MathUtil, Matrix, Point, Rect } from 'app/modules/editor/scripts/common';
import { isEqual } from 'lodash-es';

import {
  getSnapTargets,
  snapBounds,
  SnapGuide,
  snapPoint,
  SnapTargets,
  SnapThresholds,
} from './snapping';
import {
  CornerName,
  getHandleCursor,
  getHandlePoint,
  getOppositeHandle,
  HandleHit,
  HandleName,
  hitTestHandles,
  isInside,
  isSmall,
} from './selectionHandles';
import {
  duplicateLayers,
  getTopmostLayerIds,
  rotationAround,
  scalingAround,
  transformLayers,
  translateLayers,
} from './transformLayers';

/** What the select tool reads and changes. */
export interface SelectToolContext {
  /** The vector layer as it's drawn, at the current time and with any edit in progress. */
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  getSelectedLayerIds(): ReadonlySet<string>;
  setSelectedLayerIds(layerIds: ReadonlySet<string>): void;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  /** Returns the document's vector layer as it's drawn at the current time. */
  render(document: CanvasDocument): VectorLayer;
  /** The edit that a move shows until it's committed (CanvasPreview). */
  readonly preview: {
    begin(onCancel: () => void): void;
    getBase(): CanvasDocument | undefined;
    setDocument(document: CanvasDocument, layerIds?: CanvasEditLayerIds): void;
    commit(): void;
    cancel(): void;
  };
  redraw(): void;
  /** Starts editing the path's points, e.g. on a double-click, and returns whether it did. */
  editPath?(layerId: string): boolean;
  /** How close things snap, which is 8 CSS pixels (4 to the pixel grid) without it. */
  getSnapThresholds?(): SnapThresholds;
  /** The guides that moves and handles snap to, if any. */
  getGuides?(): ReadonlyArray<Guide>;
}

/** The keys held with a press or a move. What they mean depends on the gesture. */
export interface Modifiers {
  readonly shift: boolean;
  readonly alt: boolean;
  /** Cmd on Macs, and Ctrl elsewhere. */
  readonly command: boolean;
  /** Ctrl on every platform, which turns snapping off while it's held. */
  readonly ctrl: boolean;
}

// How far a press has to move to become a drag, and how close to a path hits it, in CSS pixels.
const DRAG_SLOP = 4;
const HIT_TOLERANCE = 6;
// Rotations with Shift held snap to multiples of this, in degrees.
const ROTATION_SNAP = 15;
// How close something has to be to snap, in CSS pixels.
const SNAP_THRESHOLD = 8;
const GRID_SNAP_THRESHOLD = 4;
// A scale can't reach 0, which would flatten the paths for good.
const MIN_SCALE = 1e-3;

/** What a scale or rotation starts from. */
interface Transforming {
  readonly start: Point;
  // Whether the pointer has moved far enough to start transforming.
  readonly isDragging: boolean;
  readonly bounds: Rect;
  readonly document: CanvasDocument;
  readonly rendered: VectorLayer;
  readonly layerIds: ReadonlyArray<string>;
  readonly targets: SnapTargets;
}

type State =
  | { readonly type: 'idle' }
  | {
      readonly type: 'pressed';
      readonly start: Point;
      readonly hitLayerId: string | undefined;
      // Whether the press selected the layer, rather than it being selected already.
      readonly didSelect: boolean;
      readonly modifiers: Modifiers;
    }
  | {
      readonly type: 'marquee';
      readonly start: Point;
      readonly current: Point;
      readonly isContaining: boolean;
      // The selection before the marquee, which it adds to with Shift held.
      readonly initialSelection: ReadonlySet<string>;
      // The paths it can select, which don't change while it's drawn.
      readonly boundsById: ReadonlyMap<string, Rect>;
    }
  | {
      readonly type: 'moving';
      readonly start: Point;
      // The document to move from: the edit's base, or with the duplicates in it.
      readonly document: CanvasDocument;
      readonly rendered: VectorLayer;
      readonly layerIds: ReadonlyArray<string>;
      // The copies to select, and the hidden layers with the copies of hidden ones.
      readonly layerStates: CanvasEditLayerIds | undefined;
      // Where the layers were, and what they snap to.
      readonly bounds: Rect | undefined;
      readonly targets: SnapTargets;
    }
  | ({ readonly type: 'scaling'; readonly handle: HandleName } & Transforming)
  | ({ readonly type: 'rotating'; readonly corner: CornerName } & Transforming);

/**
 * Selects and moves layers on the canvas, like Figma.
 *
 * - Clicking a path selects it, and with Shift or Cmd held, adds it to the selection or takes it
 *   away. Clicking nothing clears the selection.
 * - Dragging from nothing draws a marquee that selects the paths it touches (or, with Alt held,
 *   the ones it contains), but not clip paths.
 * - Dragging a path moves the selection, and with Alt held when the drag starts, moves copies of
 *   it instead. Shift keeps the move horizontal or vertical.
 * - Dragging a handle on the selection's bounds scales it from the handle across from it, or from
 *   the middle with Alt held, and Shift keeps its proportions. Dragging just outside of a corner
 *   rotates it around its middle, and Shift turns it in steps of 15 degrees. A path under the
 *   pointer wins over the rotation zones, and over the handles of a selection too small for all
 *   of them, so that it can still be moved.
 * - Moves and handles snap to the artboard, the other paths, and the pixel grid, unless Ctrl is
 *   held (see snapping.ts).
 * - Hovering outlines the path under the pointer, and double-clicking it edits its points
 *   (PathEditTool).
 */
export class SelectTool {
  private state: State = { type: 'idle' };
  private hoveredLayerId: string | undefined;
  private hoveredCursor: string | undefined;
  // Where the pointer last moved, to redo the gesture when a modifier key changes.
  private lastPoint: Point | undefined;
  private guides: ReadonlyArray<SnapGuide> = [];

  constructor(private readonly context: SelectToolContext) {}

  private readonly toViewportLength = (length: number) => this.context.toViewportLength(length);

  getHoveredLayerId() {
    return this.state.type === 'idle' || this.state.type === 'pressed'
      ? this.hoveredLayerId
      : undefined;
  }

  /** The snaps to show, while something moves or scales. */
  getGuides() {
    return this.guides;
  }

  /** Whether to show the selection's handles, which are hidden while it moves. */
  isShowingHandles() {
    return this.state.type !== 'moving' && this.state.type !== 'marquee';
  }

  /** The cursor for the handle being hovered or dragged, if any. */
  getCursor() {
    const { state } = this;
    if (state.type === 'scaling') {
      return getHandleCursor({ type: 'scale', handle: state.handle });
    }
    if (state.type === 'rotating') {
      return getHandleCursor({ type: 'rotate', corner: state.corner });
    }
    return state.type === 'idle' ? this.hoveredCursor : undefined;
  }

  /** Whether the point is on one of the selection's handles, which a press there would drag. */
  isOverHandle(point: Point) {
    const bounds = this.getSelectionBounds();
    return !!bounds && !!this.hitTestHandles(bounds, point, this.hitTest(point)?.id);
  }

  /** The marquee's corners in viewport coordinates, while one is being drawn. */
  getMarquee(): Rect | undefined {
    if (this.state.type !== 'marquee') {
      return undefined;
    }
    return toRect(this.state.start, this.state.current);
  }

  onPress(point: Point, modifiers: Modifiers, clickCount = 1) {
    this.lastPoint = point;
    const hitLayerId = this.hitTest(point)?.id;
    const bounds = this.getSelectionBounds();
    const handle = bounds && this.hitTestHandles(bounds, point, hitLayerId);
    if (bounds && handle) {
      this.startTransform(point, bounds, handle);
      return;
    }
    if (clickCount === 2 && hitLayerId && this.context.editPath?.(hitLayerId)) {
      // A path that can't be edited, e.g. because it's animated, gets the press as usual.
      this.state = { type: 'idle' };
      return;
    }
    let didSelect = false;
    if (hitLayerId && !isAdding(modifiers) && !this.isInSelection(hitLayerId)) {
      // Selects on the press, so that a drag moves what's under the pointer.
      this.context.setSelectedLayerIds(new Set([hitLayerId]));
      didSelect = true;
    }
    this.state = { type: 'pressed', start: point, hitLayerId, didSelect, modifiers };
  }

  onMove(point: Point, modifiers: Modifiers) {
    this.lastPoint = point;
    const { state } = this;
    switch (state.type) {
      case 'idle':
        this.hover(point);
        return;
      case 'scaling':
      case 'rotating': {
        if (!state.isDragging) {
          if (MathUtil.distance(state.start, point) <= this.toViewportLength(DRAG_SLOP)) {
            return;
          }
          this.state = { ...state, isDragging: true };
        }
        this.guides = [];
        let matrix: Matrix;
        if (state.type === 'scaling') {
          // Where the handle is dragged to, which may be a little way from the pointer.
          const { bounds, handle } = state;
          const handlePoint = getHandlePoint(bounds, handle);
          let target = {
            x: handlePoint.x + point.x - state.start.x,
            y: handlePoint.y + point.y - state.start.y,
          };
          if (!modifiers.ctrl) {
            const snap = snapPoint(
              target,
              state.targets,
              this.getSnapThresholds(),
              getSnapAxes(bounds, handle, target, modifiers),
            );
            target = { x: target.x + snap.dx, y: target.y + snap.dy };
            this.guides = snap.guides;
          }
          matrix = getScaling(bounds, handle, target, modifiers);
        } else {
          matrix = getRotation(state.bounds, state.start, point, modifiers);
        }
        this.context.preview.setDocument(
          transformLayers(state.document, state.rendered, state.layerIds, matrix),
        );
        return;
      }
      case 'pressed':
        if (MathUtil.distance(state.start, point) > this.context.toViewportLength(DRAG_SLOP)) {
          if (state.hitLayerId) {
            if (!this.isInSelection(state.hitLayerId)) {
              // A press with Shift held only adds on release, but a drag moves it with the rest.
              const selection = new Set(this.context.getSelectedLayerIds()).add(state.hitLayerId);
              this.context.setSelectedLayerIds(selection);
            }
            this.startMove(state.start, state.modifiers);
          } else {
            this.startMarquee(state.start, state.modifiers);
          }
          this.onMove(point, modifiers);
        }
        return;
      case 'marquee':
        this.state = { ...state, current: point };
        this.selectInMarquee();
        this.context.redraw();
        return;
      case 'moving': {
        let dx = point.x - state.start.x;
        let dy = point.y - state.start.y;
        let axes = { x: true, y: true };
        if (modifiers.shift) {
          // Keeps whichever direction moved more.
          const isHorizontal = Math.abs(dx) > Math.abs(dy);
          [dx, dy] = isHorizontal ? [dx, 0] : [0, dy];
          axes = { x: isHorizontal, y: !isHorizontal };
        }
        this.guides = [];
        if (state.bounds && !modifiers.ctrl) {
          const { l, t, r, b } = state.bounds;
          const moved = { l: l + dx, t: t + dy, r: r + dx, b: b + dy };
          const snap = snapBounds(moved, state.targets, this.getSnapThresholds(), axes, {
            gaps: true,
          });
          dx += snap.dx;
          dy += snap.dy;
          this.guides = snap.guides;
        }
        this.context.preview.setDocument(
          translateLayers(state.document, state.rendered, state.layerIds, dx, dy),
          state.layerStates,
        );
        return;
      }
    }
  }

  onRelease(point: Point) {
    const { state } = this;
    this.state = { type: 'idle' };
    this.guides = [];
    if (state.type === 'pressed') {
      const { hitLayerId, didSelect, modifiers } = state;
      if (hitLayerId && isAdding(modifiers)) {
        const selection = new Set(this.context.getSelectedLayerIds());
        if (!selection.delete(hitLayerId)) {
          selection.add(hitLayerId);
        }
        this.context.setSelectedLayerIds(selection);
      } else if (hitLayerId && !didSelect) {
        // A click on one of several selected layers, or inside of a selected group, selects just
        // it, but a drag moves the whole selection.
        this.context.setSelectedLayerIds(new Set([hitLayerId]));
      } else if (!hitLayerId && !isAdding(modifiers)) {
        this.context.setSelectedLayerIds(new Set());
      }
    } else if (state.type === 'moving' || state.type === 'scaling' || state.type === 'rotating') {
      this.context.preview.commit();
    }
    // The selection's handles may have moved under the pointer.
    this.hover(point);
    this.context.redraw();
  }

  /** Redoes the gesture in progress when a modifier key is pressed or released. */
  onModifiersChange(modifiers: Modifiers) {
    const { state, lastPoint } = this;
    if (
      lastPoint &&
      (state.type === 'moving' || state.type === 'scaling' || state.type === 'rotating')
    ) {
      this.onMove(lastPoint, modifiers);
    }
  }

  /** Ends the gesture where it is, e.g. when it's canceled or the pointer leaves the canvas. */
  onLeave() {
    const { state } = this;
    this.state = { type: 'idle' };
    this.hoveredLayerId = undefined;
    this.hoveredCursor = undefined;
    this.lastPoint = undefined;
    this.guides = [];
    if (state.type === 'moving' || state.type === 'scaling' || state.type === 'rotating') {
      this.context.preview.cancel();
    }
    this.context.redraw();
  }

  private startMarquee(start: Point, modifiers: Modifiers) {
    this.state = {
      type: 'marquee',
      start,
      current: start,
      isContaining: modifiers.alt,
      initialSelection: isAdding(modifiers) ? this.context.getSelectedLayerIds() : new Set(),
      boundsById: getPathLayerBounds(
        this.context.getVectorLayer(),
        this.context.getHiddenLayerIds(),
      ),
    };
  }

  private startMove(start: Point, modifiers: Modifiers) {
    const { preview } = this.context;
    preview.begin(() => {
      // E.g. undo during the drag.
      this.state = { type: 'idle' };
      this.context.redraw();
    });
    const base = preview.getBase();
    if (!base) {
      return;
    }
    let document = base;
    let layerIds = getTopmostLayerIds(base.vectorLayer, this.context.getSelectedLayerIds());
    let layerStates: CanvasEditLayerIds | undefined;
    if (modifiers.alt) {
      const duplicated = duplicateLayers(base, layerIds, this.context.getHiddenLayerIds());
      document = duplicated.document;
      layerIds = duplicated.layerIds;
      layerStates = {
        selectedLayerIds: new Set(duplicated.layerIds),
        hiddenLayerIds: duplicated.hiddenLayerIds,
      };
    }
    const rendered = this.context.render(document);
    this.state = {
      type: 'moving',
      start,
      document,
      rendered,
      layerIds,
      layerStates,
      bounds: getLayersBounds(rendered, layerIds),
      // Copies snap to their originals.
      targets: this.getSnapTargets(rendered, layerIds),
    };
  }

  private startTransform(start: Point, bounds: Rect, handle: HandleHit) {
    const { preview } = this.context;
    preview.begin(() => {
      this.state = { type: 'idle' };
      this.context.redraw();
    });
    const document = preview.getBase();
    if (!document) {
      return;
    }
    const rendered = this.context.render(document);
    const layerIds = getTopmostLayerIds(document.vectorLayer, this.context.getSelectedLayerIds());
    const transforming: Transforming = {
      start,
      isDragging: false,
      bounds,
      document,
      rendered,
      layerIds,
      targets: this.getSnapTargets(rendered, layerIds),
    };
    this.state =
      handle.type === 'scale'
        ? { type: 'scaling', handle: handle.handle, ...transforming }
        : { type: 'rotating', corner: handle.corner, ...transforming };
    this.context.redraw();
  }

  /** Returns the handle at the point, unless the path under it wins. */
  private hitTestHandles(bounds: Rect, point: Point, hitLayerId: string | undefined) {
    const handle = hitTestHandles(bounds, point, this.toViewportLength);
    if (!handle || !hitLayerId) {
      return handle;
    }
    if (handle.type === 'rotate') {
      return undefined;
    }
    const isMovable =
      this.isInSelection(hitLayerId) &&
      isSmall(bounds, this.toViewportLength) &&
      isInside(bounds, point);
    return isMovable ? undefined : handle;
  }

  /** Updates the path and the handle under the pointer, when nothing is pressed. */
  private hover(point: Point) {
    const hitLayerId = this.hitTest(point)?.id;
    const bounds = this.getSelectionBounds();
    const handle = bounds && this.hitTestHandles(bounds, point, hitLayerId);
    const cursor = handle ? getHandleCursor(handle) : undefined;
    if (this.hoveredCursor !== cursor) {
      this.hoveredCursor = cursor;
      this.context.redraw();
    }
    this.setHoveredLayerId(handle ? undefined : hitLayerId);
  }

  private getSnapThresholds() {
    return (
      this.context.getSnapThresholds?.() ?? {
        lines: this.toViewportLength(SNAP_THRESHOLD),
        grid: this.toViewportLength(GRID_SNAP_THRESHOLD),
      }
    );
  }

  private getSnapTargets(rendered: VectorLayer, layerIds: ReadonlyArray<string>) {
    return getSnapTargets(
      rendered,
      layerIds,
      this.context.getHiddenLayerIds(),
      this.context.getGuides?.(),
    );
  }

  private getSelectionBounds() {
    const selection = this.context.getSelectedLayerIds();
    return selection.size ? getLayersBounds(this.context.getVectorLayer(), selection) : undefined;
  }

  /**
   * Whether the layer or a group that it's in is selected. Not the vector layer, which is in the
   * way of selecting what's in it.
   */
  private isInSelection(layerId: string) {
    const selection = this.context.getSelectedLayerIds();
    const vl = this.context.getVectorLayer();
    for (let id = layerId; id !== vl.id;) {
      if (selection.has(id)) {
        return true;
      }
      const parent = LayerUtil.findParent(vl, id);
      if (!parent) {
        return false;
      }
      id = parent.id;
    }
    return false;
  }

  private hitTest(point: Point) {
    return hitTestLayer(this.context.getVectorLayer(), point, {
      hiddenLayerIds: this.context.getHiddenLayerIds(),
      tolerance: this.context.toViewportLength(HIT_TOLERANCE),
    });
  }

  private setHoveredLayerId(layerId: string | undefined) {
    if (this.hoveredLayerId !== layerId) {
      this.hoveredLayerId = layerId;
      this.context.redraw();
    }
  }

  private selectInMarquee() {
    const { state } = this;
    if (state.type !== 'marquee') {
      return;
    }
    const marquee = toRect(state.start, state.current);
    const selection = new Set(state.initialSelection);
    for (const [layerId, bounds] of state.boundsById) {
      if (state.isContaining ? contains(marquee, bounds) : intersects(marquee, bounds)) {
        selection.add(layerId);
      }
    }
    if (!isEqual(selection, this.context.getSelectedLayerIds())) {
      this.context.setSelectedLayerIds(selection);
    }
  }
}

function isAdding(modifiers: Modifiers) {
  return modifiers.shift || modifiers.command;
}

/**
 * Returns the point that stays put while the handle scales, and the scale on each axis for moving
 * the handle to target. An edge handle only scales across it.
 */
function getScales(bounds: Rect, handle: HandleName, target: Point, alt: boolean) {
  const anchor = alt
    ? { x: (bounds.l + bounds.r) / 2, y: (bounds.t + bounds.b) / 2 }
    : getHandlePoint(bounds, getOppositeHandle(handle));
  // How far the handle was from the anchor, and is now.
  const handlePoint = getHandlePoint(bounds, handle);
  const from = { x: handlePoint.x - anchor.x, y: handlePoint.y - anchor.y };
  const to = { x: target.x - anchor.x, y: target.y - anchor.y };
  const sx = isHorizontalEdge(handle) || !from.x ? 1 : to.x / from.x;
  const sy = isVerticalEdge(handle) || !from.y ? 1 : to.y / from.y;
  return { anchor, sx, sy };
}

/** Returns the scale for moving the handle to target. */
function getScaling(bounds: Rect, handle: HandleName, target: Point, { shift, alt }: Modifiers) {
  const scales = getScales(bounds, handle, target, alt);
  let { sx, sy } = scales;
  if (shift) {
    // Keeps the proportions, going by whichever way changed more.
    const s = isHorizontalEdge(handle)
      ? sy
      : isVerticalEdge(handle)
        ? sx
        : Math.abs(sx) > Math.abs(sy)
          ? sx
          : sy;
    sx = s;
    sy = s;
  }
  const clampScale = (s: number) => (Math.abs(s) < MIN_SCALE ? Math.sign(s || 1) * MIN_SCALE : s);
  return scalingAround(scales.anchor, clampScale(sx), clampScale(sy));
}

/**
 * Returns the axes a handle moved to target snaps on: the ones it scales, or with Shift keeping
 * the proportions, just the one that sets the scale.
 */
function getSnapAxes(bounds: Rect, handle: HandleName, target: Point, { shift, alt }: Modifiers) {
  if (isHorizontalEdge(handle)) {
    return { x: false, y: true };
  }
  if (isVerticalEdge(handle)) {
    return { x: true, y: false };
  }
  if (!shift) {
    return { x: true, y: true };
  }
  const { sx, sy } = getScales(bounds, handle, target, alt);
  const isX = Math.abs(sx) > Math.abs(sy);
  return { x: isX, y: !isX };
}

// The handles in the middles of the top and bottom edges, which only scale vertically, and of the
// left and right ones, which only scale horizontally.
function isHorizontalEdge(handle: HandleName) {
  return handle === 'n' || handle === 's';
}

function isVerticalEdge(handle: HandleName) {
  return handle === 'e' || handle === 'w';
}

/** Returns the rotation for dragging around the middle of the bounds from start to point. */
function getRotation(bounds: Rect, start: Point, point: Point, { shift }: Modifiers) {
  const center = { x: (bounds.l + bounds.r) / 2, y: (bounds.t + bounds.b) / 2 };
  const angle = (p: Point) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  let degrees = angle(point) - angle(start);
  if (shift) {
    degrees = Math.round(degrees / ROTATION_SNAP) * ROTATION_SNAP;
  }
  return rotationAround(center, degrees);
}

function toRect(a: Point, b: Point): Rect {
  return {
    l: Math.min(a.x, b.x),
    t: Math.min(a.y, b.y),
    r: Math.max(a.x, b.x),
    b: Math.max(a.y, b.y),
  };
}

function intersects(a: Rect, b: Rect) {
  return a.l <= b.r && b.l <= a.r && a.t <= b.b && b.t <= a.b;
}

function contains(outer: Rect, inner: Rect) {
  return outer.l <= inner.l && inner.r <= outer.r && outer.t <= inner.t && inner.b <= outer.b;
}
