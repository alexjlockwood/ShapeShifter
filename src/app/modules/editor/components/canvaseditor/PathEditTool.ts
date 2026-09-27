import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import { isMorphableLayer } from 'app/modules/editor/components/canvas/LayerGeometry';
import type { Guide } from 'app/modules/editor/model/guides';
import { Layer, LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import type { Anchor, HandleSide, PointType } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, Point, Rect } from 'app/modules/editor/scripts/common';
import { isEqual } from 'lodash-es';

import type { Modifiers } from './SelectTool';
import {
  getSnapTargets,
  SnapGuide,
  SnapLine,
  snapPoint,
  SnapTargets,
  SnapThresholds,
} from './snapping';

/** What the path edit tool reads and changes. */
export interface PathEditToolContext {
  /** The layer whose path is edited. */
  readonly layerId: string;
  /** The vector layer as it's drawn, at the current time and with any edit in progress. */
  getVectorLayer(): VectorLayer;
  getHiddenLayerIds(): ReadonlySet<string>;
  /** CSS pixels in viewport units, for tolerances. */
  toViewportLength(length: number): number;
  /** The edit that a gesture shows until it's committed (CanvasPreview). */
  readonly preview: {
    begin(onCancel: () => void): void;
    getBase(): CanvasDocument | undefined;
    /** The path that the edit starts from, which is a path block's value if one sets it. */
    getBasePath(layerId: string): Path | undefined;
    setPath(layerId: string, path: Path): void;
    commit(): void;
    cancel(): void;
  };
  redraw(): void;
  /** How close things snap, which is 8 CSS pixels (4 to the pixel grid) without it. */
  getSnapThresholds?(): SnapThresholds;
  /** The guides that points snap to, if any. */
  getGuides?(): ReadonlyArray<Guide>;
}

/** What the renderer draws while a path is edited, in viewport coordinates. */
export interface PathEditDrawing {
  readonly layerId: string;
  readonly anchors: ReadonlyArray<{
    readonly point: Point;
    readonly isSelected: boolean;
    readonly isHovered: boolean;
  }>;
  readonly handles: ReadonlyArray<{
    readonly anchor: Point;
    readonly handle: Point;
    readonly isHovered: boolean;
  }>;
  /** The segment under the pointer, as its start, control points, and end. */
  readonly hoveredSegment: ReadonlyArray<Point> | undefined;
  /** Where a click would add a point. */
  readonly insertPoint: Point | undefined;
  readonly marquee: Rect | undefined;
  readonly guides: ReadonlyArray<SnapGuide>;
  /** Where a moving point snapped onto a curve. */
  readonly curveSnap: Point | undefined;
}

/** A change that moves the selected points by a distance in viewport units, for nudging them. */
export interface PointsMove {
  readonly base: Path;
  move(dx: number, dy: number): Path;
}

type Hit =
  | { readonly type: 'anchor'; readonly anchorId: string }
  | { readonly type: 'handle'; readonly anchorId: string; readonly side: HandleSide }
  | { readonly type: 'segment'; readonly segmentId: string; readonly t: number };

type State =
  | { readonly type: 'idle' }
  | {
      readonly type: 'pressed';
      readonly start: Point;
      readonly hit: Hit | undefined;
      // Whether the press selected the anchor, rather than it being selected already.
      readonly didSelect: boolean;
      readonly modifiers: Modifiers;
    }
  | {
      readonly type: 'moving';
      readonly start: Point;
      readonly base: Path;
      readonly anchorIds: ReadonlySet<string>;
      // The anchor that was pressed, which snaps, in viewport coordinates.
      readonly origin: Point;
      readonly toLocal: Matrix;
      readonly targets: SnapTargets;
      // The segments that stay put, which the point snaps onto, in viewport coordinates.
      readonly curves: ReadonlyArray<ReadonlyArray<Point>>;
    }
  | {
      readonly type: 'handle';
      readonly start: Point;
      readonly base: Path;
      readonly anchorId: string;
      readonly side: HandleSide;
      readonly pointType: PointType;
      // The anchor and the handle, in viewport coordinates.
      readonly anchor: Point;
      readonly handle: Point;
      readonly toLocal: Matrix;
      readonly targets: SnapTargets;
    }
  | {
      readonly type: 'bending';
      readonly start: Point;
      readonly base: Path;
      readonly segmentId: string;
      readonly t: number;
      readonly toLocal: Matrix;
    }
  | {
      readonly type: 'marquee';
      readonly start: Point;
      readonly current: Point;
      readonly initialSelection: ReadonlySet<string>;
    };

// How far a press has to move to become a drag, and how close to a point or a segment hits it, in
// CSS pixels.
const DRAG_SLOP = 4;
const POINT_HIT_RADIUS = 6;
const SEGMENT_HIT_TOLERANCE = 6;
// How close something has to be to snap, in CSS pixels, as for layers (SelectTool).
const SNAP_THRESHOLD = 8;
const GRID_SNAP_THRESHOLD = 4;
// Handles dragged with Shift held turn in steps of this, in degrees.
const HANDLE_ANGLE_SNAP = 45;

/**
 * Edits a path's points, like Figma's and Sketch's vector editing.
 *
 * - Clicking a point selects it, and with Shift held, adds it to the selection or takes it away.
 *   Dragging from nothing draws a marquee that selects the points in it, and clicking nothing
 *   clears the selection.
 * - Dragging a point moves the selected points, with their handles. Shift keeps the move
 *   horizontal or vertical. Points snap to the other points, the artboard, the other paths'
 *   bounds, and the pixel grid, or else onto the closest curve, unless Ctrl is held.
 * - The selected points' handles, and the handles across the segments next to them, can be
 *   dragged. The handle across from the dragged one follows it, as the point's type says, unless
 *   Alt is held. Shift turns the handle in steps of 45 degrees.
 * - Clicking a segment adds a point there, or in its middle with Shift held, and dragging it moves
 *   the new point. Dragging a segment with Cmd held bends it instead.
 * - Double-clicking a point makes it smooth, or straight if it was smooth.
 */
export class PathEditTool {
  private state: State = { type: 'idle' };
  private selectedAnchorIds: ReadonlySet<string> = new Set();
  // The types picked for points, which their handles can't always tell apart, e.g. disconnected
  // handles that happen to mirror each other (see getPointType).
  private readonly pointTypes = new Map<string, PointType>();
  private hovered: Hit | undefined;
  private modifiers: Modifiers | undefined;
  // Where the pointer last moved, to redo the gesture when a modifier key changes.
  private lastPoint: Point | undefined;
  private guides: ReadonlyArray<SnapGuide> = [];
  // Where a moving point snapped onto a curve, which has no guide of its own.
  private curveSnap: Point | undefined;
  // The point that the last press hit, so that a double-click only changes a point that was there
  // for both presses, and not one that the first click added.
  private lastPressedAnchorId: string | undefined;

  constructor(private readonly context: PathEditToolContext) {}

  get layerId() {
    return this.context.layerId;
  }

  /** The ids of the selected anchors that are still in the path. */
  getSelectedAnchorIds(): ReadonlySet<string> {
    const path = this.getPath();
    if (!path) {
      return new Set();
    }
    const ids = PathEdit.getAnchors(path).map(a => a.id);
    return new Set(ids.filter(id => this.selectedAnchorIds.has(id)));
  }

  setSelectedAnchorIds(anchorIds: ReadonlySet<string>) {
    this.selectedAnchorIds = anchorIds;
    this.context.redraw();
  }

  /**
   * Joins the two selected points, if they're ends of open subpaths (Cmd+J): the ends of one
   * subpath close it, and ends of two subpaths join them into one. Returns whether it did.
   */
  joinSelected() {
    const [first, second, ...rest] = this.getSelectedAnchorIds();
    if (!first || !second || rest.length) {
      return false;
    }
    let isJoined = false;
    this.commitEdit(base => {
      const joined = PathEdit.joinEnds(base, first, second);
      isJoined = !!joined;
      return joined ?? base;
    });
    return isJoined;
  }

  selectAll() {
    const path = this.getPath();
    this.setSelectedAnchorIds(new Set(path ? PathEdit.getAnchors(path).map(a => a.id) : []));
  }

  /**
   * Selects the point after the last selected one in its subpath, or before the first one, or the
   * first point of the path if none is selected.
   */
  selectAdjacent(direction: 1 | -1) {
    const path = this.getPath();
    if (!path) {
      return;
    }
    const anchors = PathEdit.getAnchors(path);
    const selected = anchors.filter(a => this.selectedAnchorIds.has(a.id));
    if (!selected.length) {
      if (anchors.length) {
        this.setSelectedAnchorIds(new Set([anchors[direction > 0 ? 0 : anchors.length - 1].id]));
      }
      return;
    }
    const from = direction > 0 ? selected[selected.length - 1] : selected[0];
    this.setSelectedAnchorIds(new Set([PathEdit.getAdjacentAnchorId(path, from.id, direction)]));
  }

  /** Changes the selected points' type, as one undo step. */
  setPointType(type: PointType) {
    const selection = this.getSelectedAnchorIds();
    if (selection.size) {
      this.commitEdit(base => PathEdit.setPointType(base, selection, type));
      selection.forEach(anchorId => this.pointTypes.set(anchorId, type));
    }
  }

  /**
   * Deletes the selected points, as one undo step. Returns 'empty' without changing anything if
   * nothing would be left, e.g. for one end of a line, so that the layer can be deleted instead.
   */
  deleteSelected(): 'deleted' | 'empty' | 'none' {
    const selection = this.getSelectedAnchorIds();
    const path = this.getPath();
    if (!selection.size || !path) {
      return 'none';
    }
    if (!PathEdit.deleteAnchors(path, selection)) {
      return 'empty';
    }
    this.commitEdit(base => PathEdit.deleteAnchors(base, selection) ?? base);
    this.selectedAnchorIds = new Set();
    this.context.redraw();
    return 'deleted';
  }

  /**
   * Returns a move of the selected points, for nudging them, if any are selected. An edit has to
   * have begun.
   */
  getPointsMove(): PointsMove | undefined {
    const selection = this.getSelectedAnchorIds();
    const basePath = this.getBasePath();
    if (!selection.size || !basePath) {
      return undefined;
    }
    const toLocal = this.getToLocal();
    return {
      base: basePath,
      move: (dx, dy) => PathEdit.moveAnchors(basePath, selection, toLocalDelta(toLocal, dx, dy)),
    };
  }

  /** Whether the point is on the path's points, handles, or segments. */
  isOverPath(point: Point) {
    return !!this.hitTest(point);
  }

  isGestureInProgress() {
    return this.state.type !== 'idle' && this.state.type !== 'pressed';
  }

  getDrawing(): PathEditDrawing | undefined {
    const path = this.getPath();
    if (!path) {
      return undefined;
    }
    const toViewport = this.getToViewport();
    const selection = this.getSelectedAnchorIds();
    const { hovered, state } = this;
    const anchors = PathEdit.getAnchors(path);
    const handles: Array<PathEditDrawing['handles'][number]> = [];
    for (const { anchor, side, handle } of this.getVisibleHandles(path)) {
      handles.push({
        anchor: transform(anchor.point, toViewport),
        handle: transform(handle, toViewport),
        isHovered:
          hovered?.type === 'handle' && hovered.anchorId === anchor.id && hovered.side === side,
      });
    }
    const isHoverShown = state.type === 'idle';
    const hoveredSegment =
      isHoverShown && hovered?.type === 'segment'
        ? PathEdit.getSegments(path).find(s => s.id === hovered.segmentId)
        : undefined;
    return {
      layerId: this.layerId,
      anchors: anchors.map(anchor => ({
        point: transform(anchor.point, toViewport),
        isSelected: selection.has(anchor.id),
        isHovered: isHoverShown && hovered?.type === 'anchor' && hovered.anchorId === anchor.id,
      })),
      handles,
      hoveredSegment: hoveredSegment?.points.map(p => transform(p, toViewport)),
      insertPoint:
        hoveredSegment && hovered?.type === 'segment' && !this.modifiers?.command
          ? transform(
              PathEdit.getPointOnSegment(
                path,
                hovered.segmentId,
                this.modifiers?.shift ? 0.5 : hovered.t,
              ),
              toViewport,
            )
          : undefined,
      marquee: state.type === 'marquee' ? toRect(state.start, state.current) : undefined,
      guides: this.guides,
      curveSnap: state.type === 'moving' ? this.curveSnap : undefined,
    };
  }

  onPress(point: Point, modifiers: Modifiers, clickCount = 1) {
    this.lastPoint = point;
    this.modifiers = modifiers;
    const hit = this.hitTest(point);
    const lastPressedAnchorId = this.lastPressedAnchorId;
    this.lastPressedAnchorId = hit?.type === 'anchor' ? hit.anchorId : undefined;
    let didSelect = false;
    if (hit?.type === 'anchor') {
      if (clickCount === 2 && lastPressedAnchorId === hit.anchorId) {
        this.togglePointType(hit.anchorId);
        return;
      }
      if (!modifiers.shift && !this.selectedAnchorIds.has(hit.anchorId)) {
        // Selects on the press, so that a drag moves what's under the pointer.
        this.setSelectedAnchorIds(new Set([hit.anchorId]));
        didSelect = true;
      }
    }
    this.state = { type: 'pressed', start: point, hit, didSelect, modifiers };
  }

  onMove(point: Point, modifiers: Modifiers) {
    this.lastPoint = point;
    this.modifiers = modifiers;
    const { state } = this;
    switch (state.type) {
      case 'idle':
        this.hover(point);
        return;
      case 'pressed':
        if (MathUtil.distance(state.start, point) > this.context.toViewportLength(DRAG_SLOP)) {
          this.startDrag(state);
          if (this.state.type !== 'pressed') {
            this.onMove(point, modifiers);
          }
        }
        return;
      case 'marquee': {
        this.state = { ...state, current: point };
        this.selectInMarquee();
        this.context.redraw();
        return;
      }
      case 'moving': {
        let dx = point.x - state.start.x;
        let dy = point.y - state.start.y;
        let axes = { x: true, y: true };
        if (modifiers.shift) {
          const isHorizontal = Math.abs(dx) > Math.abs(dy);
          [dx, dy] = isHorizontal ? [dx, 0] : [0, dy];
          axes = { x: isHorizontal, y: !isHorizontal };
        }
        this.guides = [];
        this.curveSnap = undefined;
        if (!modifiers.ctrl) {
          const target = { x: state.origin.x + dx, y: state.origin.y + dy };
          const thresholds = this.getSnapThresholds();
          const snap = snapPoint(target, state.targets, thresholds, axes);
          // Without something to line up with, it snaps onto the closest curve, unless that would
          // take it off of the axis that Shift keeps it on.
          const onCurve =
            snap.guides.length || modifiers.shift
              ? undefined
              : snapOntoCurves(target, state.curves, thresholds.lines);
          this.curveSnap = onCurve;
          if (onCurve) {
            dx = onCurve.x - state.origin.x;
            dy = onCurve.y - state.origin.y;
          } else {
            dx += snap.dx;
            dy += snap.dy;
            this.guides = snap.guides;
          }
        }
        this.context.preview.setPath(
          this.layerId,
          PathEdit.moveAnchors(state.base, state.anchorIds, toLocalDelta(state.toLocal, dx, dy)),
        );
        return;
      }
      case 'handle': {
        let target = {
          x: state.handle.x + point.x - state.start.x,
          y: state.handle.y + point.y - state.start.y,
        };
        this.guides = [];
        if (modifiers.shift) {
          const delta = MathUtil.snapVectorToAngle(
            { x: target.x - state.anchor.x, y: target.y - state.anchor.y },
            HANDLE_ANGLE_SNAP,
          );
          target = { x: state.anchor.x + delta.x, y: state.anchor.y + delta.y };
        } else if (!modifiers.ctrl) {
          const snap = snapPoint(target, state.targets, this.getSnapThresholds());
          target = { x: target.x + snap.dx, y: target.y + snap.dy };
          this.guides = snap.guides;
        }
        this.context.preview.setPath(
          this.layerId,
          PathEdit.moveHandle(
            state.base,
            state.anchorId,
            state.side,
            transform(target, state.toLocal),
            modifiers.alt ? 'disconnected' : state.pointType,
          ),
        );
        return;
      }
      case 'bending': {
        const delta = toLocalDelta(state.toLocal, point.x - state.start.x, point.y - state.start.y);
        this.context.preview.setPath(
          this.layerId,
          PathEdit.bendSegment(state.base, state.segmentId, state.t, delta),
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
      const { hit, didSelect, modifiers } = state;
      if (hit?.type === 'anchor') {
        if (modifiers.shift) {
          const selection = new Set(this.selectedAnchorIds);
          if (!selection.delete(hit.anchorId)) {
            selection.add(hit.anchorId);
          }
          this.setSelectedAnchorIds(selection);
        } else if (!didSelect) {
          // A click on one of several selected points selects just it, but a drag moves them all.
          this.setSelectedAnchorIds(new Set([hit.anchorId]));
        }
      } else if (hit?.type === 'segment') {
        if (!modifiers.command) {
          this.insertAnchor(hit, modifiers.shift);
          this.context.preview.commit();
        }
      } else if (!hit && !modifiers.shift) {
        this.setSelectedAnchorIds(new Set());
      }
    } else if (state.type === 'moving' || state.type === 'handle' || state.type === 'bending') {
      this.context.preview.commit();
    }
    this.hover(point);
    this.context.redraw();
  }

  /** Redoes the gesture in progress when a modifier key is pressed or released. */
  onModifiersChange(modifiers: Modifiers) {
    this.modifiers = modifiers;
    const { lastPoint } = this;
    if (lastPoint && this.isGestureInProgress()) {
      this.onMove(lastPoint, modifiers);
    } else {
      // The point a click would add moves to the middle of the segment with Shift held.
      this.context.redraw();
    }
  }

  /** Ends the gesture where it is, e.g. when it's canceled or the pointer leaves the canvas. */
  onLeave() {
    const wasEditing = this.isGestureInProgress();
    this.state = { type: 'idle' };
    this.hovered = undefined;
    this.lastPoint = undefined;
    this.guides = [];
    this.curveSnap = undefined;
    if (wasEditing) {
      this.context.preview.cancel();
    }
    this.context.redraw();
  }

  private startDrag(state: Extract<State, { type: 'pressed' }>) {
    const { hit, start, modifiers } = state;
    if (!hit) {
      this.state = {
        type: 'marquee',
        start,
        current: start,
        initialSelection: modifiers.shift ? this.selectedAnchorIds : new Set(),
      };
      return;
    }
    const base = this.beginEdit();
    if (!base) {
      this.state = { type: 'idle' };
      return;
    }
    const toLocal = this.getToLocal();
    const toViewport = this.getToViewport();
    if (hit.type === 'segment') {
      if (modifiers.command) {
        this.state = { type: 'bending', start, base, segmentId: hit.segmentId, t: hit.t, toLocal };
        return;
      }
      // Adds a point under the pointer, rather than in the middle with Shift held, since Shift
      // keeps the move straight, and moves it.
      const anchorId = this.insertAnchor(hit, false);
      const path = this.getPath();
      const anchor = path && PathEdit.getAnchors(path).find(a => a.id === anchorId);
      if (!anchorId || !path || !anchor) {
        this.context.preview.cancel();
        this.state = { type: 'idle' };
        return;
      }
      this.startMove(start, path, new Set([anchorId]), transform(anchor.point, toViewport));
      return;
    }
    const anchor = PathEdit.getAnchors(base).find(a => a.id === hit.anchorId);
    if (!anchor) {
      this.context.preview.cancel();
      return;
    }
    if (hit.type === 'handle') {
      const handle = hit.side === 'in' ? anchor.in : anchor.out;
      if (!handle) {
        this.context.preview.cancel();
        return;
      }
      this.state = {
        type: 'handle',
        start,
        base,
        anchorId: anchor.id,
        side: hit.side,
        pointType: this.getPointType(anchor),
        anchor: transform(anchor.point, toViewport),
        handle: transform(handle, toViewport),
        toLocal,
        targets: this.getSnapTargets(base, new Set()),
      };
      return;
    }
    if (!this.selectedAnchorIds.has(anchor.id)) {
      // A press with Shift held only adds on release, but a drag moves it with the rest.
      this.setSelectedAnchorIds(new Set(this.selectedAnchorIds).add(anchor.id));
    }
    this.startMove(start, base, this.getSelectedAnchorIds(), transform(anchor.point, toViewport));
  }

  private startMove(start: Point, base: Path, anchorIds: ReadonlySet<string>, origin: Point) {
    this.state = {
      type: 'moving',
      start,
      base,
      anchorIds,
      origin,
      toLocal: this.getToLocal(),
      targets: this.getSnapTargets(base, anchorIds),
      curves: this.getSnapCurves(base, anchorIds),
    };
  }

  /**
   * Returns the segments that don't move with the anchors, in this path and the other visible
   * ones, in viewport coordinates.
   */
  private getSnapCurves(base: Path, movingAnchorIds: ReadonlySet<string>) {
    const vl = this.context.getVectorLayer();
    const hiddenLayerIds = this.context.getHiddenLayerIds();
    const curves: Point[][] = [];
    const layerId = this.layerId;
    (function recurseFn(layer: Layer) {
      if (hiddenLayerIds.has(layer.id)) {
        return;
      }
      // Clip paths aren't drawn, so only the edited one counts.
      const path = layer.id === layerId ? base : layer instanceof PathLayer && layer.pathData;
      if (path) {
        const toViewport = LayerUtil.getCanvasTransformForLayer(vl, layer.id);
        for (const segment of PathEdit.getSegments(path)) {
          if (
            layer.id !== layerId ||
            !(
              movingAnchorIds.has(segment.startAnchorId) || movingAnchorIds.has(segment.endAnchorId)
            )
          ) {
            curves.push(segment.points.map(p => transform(p, toViewport)));
          }
        }
      }
      layer.children.forEach(recurseFn);
    })(vl);
    return curves;
  }

  /** Adds a point where the segment was pressed, or in its middle, and selects it. Returns its id. */
  private insertAnchor(hit: Extract<Hit, { type: 'segment' }>, isMiddle: boolean) {
    const base = this.context.preview.getBase() ? this.getBasePath() : this.beginEdit();
    if (!base) {
      return undefined;
    }
    const { path, anchorId } = PathEdit.insertAnchor(base, hit.segmentId, isMiddle ? 0.5 : hit.t);
    this.context.preview.setPath(this.layerId, path);
    this.setSelectedAnchorIds(new Set([anchorId]));
    return anchorId;
  }

  /** Makes a smooth point straight, and any other point mirrored, as one undo step. */
  private togglePointType(anchorId: string) {
    const path = this.getPath();
    const anchor = path && PathEdit.getAnchors(path).find(a => a.id === anchorId);
    if (!anchor) {
      return;
    }
    const type = anchor.type === 'straight' ? 'mirrored' : 'straight';
    this.commitEdit(base => PathEdit.setPointType(base, new Set([anchorId]), type));
    this.pointTypes.set(anchorId, type);
    this.setSelectedAnchorIds(new Set([anchorId]));
  }

  /**
   * Returns the point's type: the one picked for it, as long as its handles still fit it, or else
   * the one its handles have. Mirrored handles fit any type but straight, and lined up ones fit
   * asymmetric and disconnected.
   */
  private getPointType(anchor: Anchor): PointType {
    const picked = this.pointTypes.get(anchor.id);
    const fits =
      picked === anchor.type ||
      picked === 'disconnected' ||
      (picked === 'asymmetric' && anchor.type === 'mirrored');
    return picked && fits ? picked : anchor.type;
  }

  /** Starts an edit, and returns the path it starts from. */
  private beginEdit() {
    this.context.preview.begin(() => {
      // E.g. undo during the drag.
      this.state = { type: 'idle' };
      this.guides = [];
      this.context.redraw();
    });
    const base = this.getBasePath();
    if (!base) {
      this.context.preview.cancel();
    }
    return base;
  }

  private commitEdit(edit: (base: Path) => Path) {
    const base = this.beginEdit();
    const path = base && edit(base);
    if (!base || !path || path.getPathString() === base.getPathString()) {
      // E.g. a smooth point made disconnected, which only changes how its handles are dragged.
      this.context.preview.cancel();
      return;
    }
    this.context.preview.setPath(this.layerId, path);
    this.context.preview.commit();
  }

  private getBasePath() {
    return this.context.preview.getBasePath(this.layerId);
  }

  /** The path as it's drawn. */
  private getPath() {
    return getLayerPath(this.context.getVectorLayer(), this.layerId);
  }

  private getToViewport() {
    return LayerUtil.getCanvasTransformForLayer(this.context.getVectorLayer(), this.layerId);
  }

  private getToLocal() {
    // A group scaled to 0 hides the path, so there's nothing to edit.
    return this.getToViewport().invert() ?? Matrix.identity();
  }

  /**
   * The handles to show: the selected points', and the ones across the segments next to them, so
   * that a segment's shape can be changed from either end.
   */
  private getVisibleHandles(path: Path) {
    const selection = this.getSelectedAnchorIds();
    const anchors = PathEdit.getAnchors(path);
    const shown = new Set<string>();
    for (const segment of PathEdit.getSegments(path)) {
      if (selection.has(segment.startAnchorId) || selection.has(segment.endAnchorId)) {
        shown.add(`${segment.startAnchorId}:out`);
        shown.add(`${segment.endAnchorId}:in`);
      }
    }
    const handles: { anchor: Anchor; side: HandleSide; handle: Point }[] = [];
    for (const anchor of anchors) {
      for (const side of ['in', 'out'] as const) {
        const handle = anchor[side];
        if (
          handle &&
          shown.has(`${anchor.id}:${side}`) &&
          !MathUtil.arePointsEqual(handle, anchor.point)
        ) {
          handles.push({ anchor, side, handle });
        }
      }
    }
    return handles;
  }

  private hitTest(point: Point): Hit | undefined {
    const path = this.getPath();
    if (!path) {
      return undefined;
    }
    const toViewport = this.getToViewport();
    const radius = this.context.toViewportLength(POINT_HIT_RADIUS);
    let best: { hit: Hit; distance: number } | undefined;
    const consider = (hit: Hit, p: Point) => {
      const distance = MathUtil.distance(transform(p, toViewport), point);
      // Points win over handles at the same distance, since a handle can be dragged off of one.
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { hit, distance };
      }
    };
    for (const anchor of PathEdit.getAnchors(path)) {
      consider({ type: 'anchor', anchorId: anchor.id }, anchor.point);
    }
    for (const { anchor, side, handle } of this.getVisibleHandles(path)) {
      consider({ type: 'handle', anchorId: anchor.id, side }, handle);
    }
    if (best) {
      return best.hit;
    }
    const projection = PathEdit.projectOntoSegments(path, transform(point, this.getToLocal()));
    if (
      projection &&
      MathUtil.distance(transform(projection.point, toViewport), point) <=
        this.context.toViewportLength(SEGMENT_HIT_TOLERANCE)
    ) {
      return { type: 'segment', segmentId: projection.segmentId, t: projection.t };
    }
    return undefined;
  }

  private hover(point: Point) {
    const hit = this.hitTest(point);
    if (!isEqual(hit, this.hovered)) {
      this.hovered = hit;
      this.context.redraw();
    }
  }

  private getSnapThresholds(): SnapThresholds {
    return (
      this.context.getSnapThresholds?.() ?? {
        lines: this.context.toViewportLength(SNAP_THRESHOLD),
        grid: this.context.toViewportLength(GRID_SNAP_THRESHOLD),
      }
    );
  }

  /**
   * What points snap to: the artboard, the other paths' bounds, and the points of this path that
   * aren't moving.
   */
  private getSnapTargets(base: Path, movingAnchorIds: ReadonlySet<string>): SnapTargets {
    const vl = this.context.getVectorLayer();
    const targets = getSnapTargets(
      vl,
      [this.layerId],
      this.context.getHiddenLayerIds(),
      this.context.getGuides?.(),
    );
    const toViewport = this.getToViewport();
    const x: SnapLine[] = [...targets.x];
    const y: SnapLine[] = [...targets.y];
    for (const anchor of PathEdit.getAnchors(base)) {
      if (!movingAnchorIds.has(anchor.id)) {
        const p = transform(anchor.point, toViewport);
        x.push({ value: p.x, from: p.y, to: p.y });
        y.push({ value: p.y, from: p.x, to: p.x });
      }
    }
    return { x, y };
  }

  private selectInMarquee() {
    const { state } = this;
    const path = this.getPath();
    if (state.type !== 'marquee' || !path) {
      return;
    }
    const marquee = toRect(state.start, state.current);
    const toViewport = this.getToViewport();
    const selection = new Set(state.initialSelection);
    for (const anchor of PathEdit.getAnchors(path)) {
      const { x, y } = transform(anchor.point, toViewport);
      if (marquee.l <= x && x <= marquee.r && marquee.t <= y && y <= marquee.b) {
        selection.add(anchor.id);
      }
    }
    if (!isEqual(selection, this.selectedAnchorIds)) {
      this.selectedAnchorIds = selection;
    }
  }
}

/** Returns the closest point on the curves to the point, if one is within the threshold. */
function snapOntoCurves(
  point: Point,
  curves: ReadonlyArray<ReadonlyArray<Point>>,
  threshold: number,
): Point | undefined {
  let best: { point: Point; distance: number } | undefined;
  for (const curve of curves) {
    if (PathEdit.getDistanceToHull(curve, point) > threshold) {
      // Most curves are far away, and this is much cheaper than projecting onto them.
      continue;
    }
    const projection = PathEdit.projectOntoCurve(curve, point);
    if (projection.distance <= threshold && (!best || projection.distance < best.distance)) {
      best = projection;
    }
  }
  return best?.point;
}

/** Returns the layer's path, if it's a path or a clip path that has one. */
export function getLayerPath(vl: VectorLayer, layerId: string) {
  const layer = vl.findLayerById(layerId);
  return isMorphableLayer(layer) ? layer.pathData : undefined;
}

function transform(point: Point, matrix: Matrix) {
  return MathUtil.transformPoint(point, matrix);
}

/** Converts a distance in viewport units to the path's coordinates. */
function toLocalDelta(toLocal: Matrix, dx: number, dy: number): Point {
  return { x: toLocal.a * dx + toLocal.c * dy, y: toLocal.b * dx + toLocal.d * dy };
}

function toRect(a: Point, b: Point): Rect {
  return {
    l: Math.min(a.x, b.x),
    t: Math.min(a.y, b.y),
    r: Math.max(a.x, b.x),
    b: Math.max(a.y, b.y),
  };
}
