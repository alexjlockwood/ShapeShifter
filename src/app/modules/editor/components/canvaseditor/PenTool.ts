import { isMorphableLayer } from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';

import { CanvasTool, DrawToolContext, ToolOverlay } from './drawTools';
import { addNewLayer, createPathLayer, getNewLayerPlace } from './newLayers';
import { getLayerPath } from './PathEditTool';
import type { Modifiers } from './SelectTool';
import {
  getSnapTargets,
  snapAlongLineToGrid,
  SnapGuide,
  SnapLine,
  snapPoint,
  SnapTargets,
} from './snapping';

export interface PenToolContext extends DrawToolContext {
  /** The path whose points are being edited, which the pen adds subpaths to, if any. */
  readonly targetLayerId?: string;
}

/** The subpath that the pen is drawing, between presses. */
interface Drawing {
  readonly layerId: string;
  // The subpath's last point, which the pen draws on from. It's kept by id rather than by the
  // subpath's index, since editing the other subpaths can change that.
  readonly lastAnchorId: string;
  // The subpath's first point, to find it again when undo takes its last point away.
  readonly firstAnchorId: string;
  // Whether the pen draws on from the start of a subpath, which is only reversed once a point is
  // added, so that a press on an end that adds nothing doesn't change the path.
  readonly isReversed: boolean;
  // The last point's handle for the next segment, in the layer's coordinates.
  readonly pendingOut: Point | undefined;
  // Whether the pen started the subpath, rather than going on from the end of one, and so
  // whether it's the pen's to delete if it's left with one point.
  readonly isNew: boolean;
  // The path as the pen left it, to tell when something else, like undo, changes it.
  readonly path: Path;
}

interface Press {
  // Starting a subpath (or going on from the end of one), adding a point, or closing it.
  readonly kind: 'start' | 'append' | 'close';
  readonly start: Point;
  // Where the point went, in viewport coordinates.
  readonly anchor: Point;
  readonly anchorId: string;
  readonly firstAnchorId: string;
  readonly layerId: string;
  readonly subIdx: number;
  readonly isNew: boolean;
  readonly isReversed: boolean;
  // The handle into the new point, in the layer's coordinates, which stays where it is while Alt
  // is held.
  readonly c2: Point | undefined;
  // The path before an added point, or with the new subpath.
  readonly before: Path;
  readonly pendingOut: Point | undefined;
  readonly toLocal: Matrix;
  // Where the pointer is, and the handle that a drag pulls out of the point, which Shift can turn
  // away from it, in viewport coordinates.
  readonly pointer: Point | undefined;
  readonly handle: Point | undefined;
}

// How far a press has to move to pull out handles, and how close to a point hits it, in CSS
// pixels.
const DRAG_SLOP = 4;
const POINT_HIT_RADIUS = 6;
// Points and handles placed with Shift held turn in steps of this, in degrees.
const ANGLE_SNAP = 45;

/**
 * Draws paths point by point, like Figma's and Sketch's pen.
 *
 * - A click adds a corner, and a drag adds a smooth point, pulling out its handles. Alt breaks
 *   them, so that only the one being dragged moves. Shift keeps the new segment, or the handle, at
 *   a multiple of 45 degrees. Points snap like moves do, unless Ctrl is held.
 * - Clicking the first point closes the path, and dragging it pulls out its handles too. Enter,
 *   Escape, a double-click, or clicking the last point again finish the path open.
 * - Each point is one undo step. The first one makes a new stroked layer, in the selected group
 *   (see getNewLayerSpot), unless a path's points are being edited: then the pen adds a
 *   subpath to it, or goes on from the end of one of its open subpaths if that's pressed.
 */
export class PenTool implements CanvasTool {
  private drawing: Drawing | undefined;
  private press: Press | undefined;
  private hoverPoint: Point | undefined;
  private modifiers: Modifiers | undefined;
  private guides: ReadonlyArray<SnapGuide> = [];

  constructor(private readonly context: PenToolContext) {}

  get targetLayerId() {
    return this.context.targetLayerId;
  }

  isDrawing() {
    this.sync();
    return !!this.drawing;
  }

  getCursor() {
    return this.isOverClose(this.hoverPoint) ? 'pen-close' : 'pen';
  }

  getOverlay(): ToolOverlay {
    this.sync();
    const { drawing, press, hoverPoint } = this;
    const current = press ?? (drawing && this.findDrawing(drawing));
    const path = current && getLayerPath(this.context.getVectorLayer(), current.layerId);
    if (!current || !path) {
      return { curves: [], anchors: [], handles: [], guides: this.guides };
    }
    const toViewport = this.getToViewport(current.layerId);
    const anchors = getSubPathAnchors(path, current.subIdx).map(p => transform(p, toViewport));
    if (!press && current.isReversed) {
      // In the order the pen draws them, from the subpath's start.
      anchors.reverse();
    }
    const isOverClose = !press && this.isOverClose(hoverPoint);
    const handles: Array<{ anchor: Point; handle: Point }> = [];
    const curves: Point[][] = [];
    const last = anchors[anchors.length - 1];
    if (press?.handle) {
      const { anchor, handle } = press;
      handles.push({ anchor, handle });
      if (!this.modifiers?.alt && press.kind !== 'start') {
        handles.push({
          anchor,
          handle: { x: 2 * anchor.x - handle.x, y: 2 * anchor.y - handle.y },
        });
      }
    } else if (drawing?.pendingOut && last) {
      handles.push({ anchor: last, handle: transform(drawing.pendingOut, toViewport) });
    }
    if (!press && drawing && last && hoverPoint) {
      // The segment that a click would add.
      const end = isOverClose ? anchors[0] : this.place(hoverPoint, last, this.modifiers).point;
      const out = drawing.pendingOut && transform(drawing.pendingOut, toViewport);
      curves.push(out ? [last, out, end, end] : [last, end]);
    }
    return {
      curves,
      anchors: anchors.map((point, i) => ({ point, isHovered: i === 0 && isOverClose })),
      handles,
      guides: this.guides,
    };
  }

  onPress(point: Point, modifiers: Modifiers, clickCount = 1) {
    this.modifiers = modifiers;
    this.sync();
    const { drawing } = this;
    if (drawing && (clickCount === 2 || this.isOverLast(point))) {
      // The first click of a double-click added the last point, and a click on it finishes too.
      this.finish();
      this.context.finish();
      return;
    }
    const { preview } = this.context;
    preview.begin(() => {
      this.press = undefined;
      this.context.redraw();
    });
    try {
      const found = drawing && this.findDrawing(drawing);
      this.press = found
        ? this.pressWhileDrawing(point, drawing, found.subIdx)
        : this.pressToStart(point);
    } catch (error) {
      // A press that fails ends there, rather than leaving an edit open for the next one.
      this.press = undefined;
      this.drawing = undefined;
      preview.cancel();
      throw error;
    }
    if (!this.press) {
      preview.cancel();
    }
    this.guides = [];
    this.context.redraw();
  }

  onMove(point: Point, modifiers: Modifiers) {
    this.modifiers = modifiers;
    const { press } = this;
    if (!press) {
      this.hoverPoint = point;
      this.context.redraw();
      return;
    }
    if (
      !press.handle &&
      MathUtil.distance(press.start, point) <= this.context.toViewportLength(DRAG_SLOP)
    ) {
      return;
    }
    let handle = point;
    if (modifiers.shift) {
      const delta = MathUtil.snapVectorToAngle(
        { x: point.x - press.anchor.x, y: point.y - press.anchor.y },
        ANGLE_SNAP,
      );
      handle = { x: press.anchor.x + delta.x, y: press.anchor.y + delta.y };
    }
    this.press = { ...press, pointer: point, handle };
    const local = transform(handle, press.toLocal);
    const anchor = transform(press.anchor, press.toLocal);
    // The handle into the point mirrors the one being pulled out, unless Alt breaks them, which
    // leaves it where it was.
    const c2 = modifiers.alt ? press.c2 : { x: 2 * anchor.x - local.x, y: 2 * anchor.y - local.y };
    this.press = { ...this.press, c2 };
    if (press.kind === 'append') {
      const { path } = PathEdit.appendAnchor(
        press.before,
        press.subIdx,
        anchor,
        { c1: press.pendingOut, c2 },
        press.anchorId,
      );
      this.context.preview.setPath(press.layerId, path);
    } else if (press.kind === 'close') {
      this.context.preview.setPath(
        press.layerId,
        PathEdit.closeSubPath(press.before, press.subIdx, { c1: press.pendingOut, c2 }, local),
      );
    } else {
      this.context.redraw();
    }
  }

  onRelease(point: Point) {
    const { press } = this;
    this.press = undefined;
    this.hoverPoint = point;
    if (!press) {
      return;
    }
    this.context.preview.commit();
    const path = getLayerPath(this.context.getVectorLayer(), press.layerId);
    if (press.kind === 'close' || !path) {
      this.drawing = undefined;
      this.context.finish();
      return;
    }
    this.drawing = {
      layerId: press.layerId,
      lastAnchorId: press.anchorId,
      firstAnchorId: press.firstAnchorId,
      // Adding or closing reversed the subpath, if it needed to be.
      isReversed: press.kind === 'start' && press.isReversed,
      pendingOut: press.handle && transform(press.handle, press.toLocal),
      isNew: press.isNew,
      path,
    };
    this.context.redraw();
  }

  onModifiersChange(modifiers: Modifiers) {
    this.modifiers = modifiers;
    const { press } = this;
    if (press?.pointer) {
      this.onMove(press.pointer, modifiers);
    } else {
      this.context.redraw();
    }
  }

  onLeave() {
    const { press } = this;
    this.press = undefined;
    this.hoverPoint = undefined;
    this.guides = [];
    if (press) {
      this.context.preview.cancel();
    }
    this.context.redraw();
  }

  /**
   * Stops drawing, with the subpath left open. A subpath that the pen started and left with just
   * its first point is deleted, along with its layer if that's all the layer had.
   */
  finish() {
    this.onLeave();
    const { drawing } = this;
    this.drawing = undefined;
    if (!drawing?.isNew) {
      return;
    }
    // From the document rather than as it's drawn, since the time may have moved into one of the
    // layer's path blocks, which is why the pen stopped. The point is gone either way.
    const { preview } = this.context;
    preview.begin(() => {});
    const base = preview.getBase();
    const layer = base?.vectorLayer.findLayerById(drawing.layerId);
    const path = isMorphableLayer(layer) ? layer.pathData : undefined;
    const found = path && this.findDrawing({ ...drawing, path });
    if (
      !base ||
      !isMorphableLayer(layer) ||
      !path ||
      !found ||
      PathEdit.getAnchorCount(path, found.subIdx) > 1
    ) {
      preview.cancel();
      return;
    }
    const remaining = PathEdit.deleteAnchors(path, new Set([found.lastAnchorId]));
    if (remaining) {
      const clone = layer.clone();
      clone.pathData = remaining;
      preview.setDocument({
        vectorLayer: LayerUtil.replaceLayer(base.vectorLayer, layer.id, clone),
        animation: base.animation,
      });
    } else {
      // The layer only had the point, so it goes, with any animation blocks it was given since.
      const selected = this.context.getSelectedLayerIds();
      const blocks = base.animation.blocks.filter(block => block.layerId !== layer.id);
      const animation = base.animation.clone();
      animation.blocks = blocks;
      preview.setDocument(
        {
          vectorLayer: LayerUtil.removeLayers(base.vectorLayer, layer.id),
          animation: blocks.length === base.animation.blocks.length ? base.animation : animation,
        },
        // Only if it was selected, since setting the selection clears the timeline's too.
        selected.has(layer.id)
          ? { selectedLayerIds: new Set([...selected].filter(id => id !== layer.id)) }
          : undefined,
      );
    }
    preview.commit();
  }

  /** Adds a point to the subpath being drawn, or closes it if its first point is pressed. */
  private pressWhileDrawing(point: Point, drawing: Drawing, subIdx: number): Press | undefined {
    const { layerId, pendingOut, isNew, firstAnchorId } = drawing;
    // The pen adds to the end, so a subpath it goes on from the start of is turned around first.
    const before = drawing.isReversed
      ? PathEdit.reverseSubPath(drawing.path, subIdx)
      : drawing.path;
    const toLocal = this.getToLocal(layerId);
    const toViewport = this.getToViewport(layerId);
    const anchors = PathEdit.getAnchors(before).filter(a => a.subIdx === subIdx);
    const press = {
      start: point,
      layerId,
      subIdx,
      isNew,
      isReversed: false,
      firstAnchorId,
      before,
      pendingOut,
      toLocal,
      pointer: undefined,
      handle: undefined,
    };
    if (this.isOverClose(point)) {
      // A first point with a handle out stays smooth, with a mirrored handle in.
      const [first] = anchors;
      const out =
        first.out && !MathUtil.arePointsEqual(first.out, first.point) ? first.out : undefined;
      const c2 = out && { x: 2 * first.point.x - out.x, y: 2 * first.point.y - out.y };
      this.context.preview.setPath(
        layerId,
        PathEdit.closeSubPath(before, subIdx, { c1: pendingOut, c2 }),
      );
      return {
        ...press,
        kind: 'close',
        anchor: transform(first.point, toViewport),
        anchorId: drawing.lastAnchorId,
        c2,
      };
    }
    const last = anchors[anchors.length - 1];
    const anchor = this.place(
      point,
      last && transform(last.point, toViewport),
      this.modifiers,
    ).point;
    const { path, anchorId } = PathEdit.appendAnchor(before, subIdx, transform(anchor, toLocal), {
      c1: pendingOut,
    });
    this.context.preview.setPath(layerId, path);
    return { ...press, kind: 'append', anchor, anchorId, c2: undefined };
  }

  /**
   * Removes the last point of the path being drawn, like Backspace does in Figma, and returns
   * whether there was one. Removing the only point finishes the path.
   */
  removeLastPoint() {
    this.sync();
    const { drawing } = this;
    const found = drawing && this.findDrawing(drawing);
    if (!drawing || !found || this.press) {
      return false;
    }
    if (PathEdit.getAnchorCount(drawing.path, found.subIdx) <= 1) {
      this.finish();
      return true;
    }
    const { preview } = this.context;
    preview.begin(() => {});
    const base = preview.getBase();
    const layer = base?.vectorLayer.findLayerById(drawing.layerId);
    const remaining =
      isMorphableLayer(layer) && layer.pathData
        ? PathEdit.deleteAnchors(layer.pathData, new Set([found.lastAnchorId]))
        : undefined;
    if (!base || !isMorphableLayer(layer) || !remaining) {
      preview.cancel();
      return false;
    }
    const clone = layer.clone();
    clone.pathData = remaining;
    preview.setDocument({
      vectorLayer: LayerUtil.replaceLayer(base.vectorLayer, layer.id, clone),
      animation: base.animation,
    });
    preview.commit();
    // The next point goes on from the one before, which sync finds from the subpath's first one.
    this.sync();
    this.context.redraw();
    return true;
  }

  /**
   * Starts a subpath: on the end of the edited path's open subpath under the pointer, or a new one
   * in the edited path, or a new layer.
   */
  private pressToStart(point: Point): Press | undefined {
    const { preview, targetLayerId } = this.context;
    const base = preview.getBase();
    if (!base) {
      return undefined;
    }
    const targetPath = targetLayerId && getLayerPath(base.vectorLayer, targetLayerId);
    if (targetLayerId && targetPath) {
      if (!this.context.canEditPath(targetLayerId)) {
        return undefined;
      }
      const toLocal = this.getToLocal(targetLayerId);
      const toViewport = this.getToViewport(targetLayerId);
      const radius = this.context.toViewportLength(POINT_HIT_RADIUS);
      const end = PathEdit.getSubPathEnds(targetPath).find(
        e => MathUtil.distance(transform(e.point, toViewport), point) <= radius,
      );
      const press = {
        start: point,
        layerId: targetLayerId,
        toLocal,
        pointer: undefined,
        handle: undefined,
        pendingOut: undefined,
      };
      if (end) {
        // The path doesn't change until a point is added, so that a press on an end that adds
        // nothing isn't an undo step of its own.
        const other = PathEdit.getSubPathEnds(targetPath).find(
          e => e.subIdx === end.subIdx && e.anchorId !== end.anchorId,
        );
        return {
          ...press,
          kind: 'start',
          subIdx: end.subIdx,
          anchorId: end.anchorId,
          firstAnchorId: other?.anchorId ?? end.anchorId,
          isNew: false,
          isReversed: end.isStart,
          before: targetPath,
          anchor: transform(end.point, toViewport),
          c2: undefined,
        };
      }
      const anchor = this.place(point, undefined, this.modifiers).point;
      const added = PathEdit.addSubPath(targetPath, transform(anchor, toLocal));
      preview.setPath(targetLayerId, added.path);
      return {
        ...press,
        kind: 'start',
        subIdx: added.subIdx,
        anchorId: added.anchorId,
        firstAnchorId: added.anchorId,
        isNew: true,
        isReversed: false,
        c2: undefined,
        before: added.path,
        anchor,
      };
    }
    const place = getNewLayerPlace(
      base,
      this.context.getSelectedLayerIds(),
      this.context.getHiddenLayerIds(),
      document => this.context.render(document),
    );
    const anchor = this.place(point, undefined, this.modifiers).point;
    const { toLocal } = place;
    const { path, anchorId } = PathEdit.addSubPath(undefined, transform(anchor, toLocal));
    const layer = createPathLayer(base.vectorLayer, 'path', path, 'stroked', place);
    preview.setDocument(addNewLayer(base, place, layer), {
      selectedLayerIds: new Set([layer.id]),
    });
    return {
      kind: 'start',
      start: point,
      anchor,
      anchorId,
      firstAnchorId: anchorId,
      layerId: layer.id,
      subIdx: 0,
      isNew: true,
      isReversed: false,
      c2: undefined,
      before: path,
      pendingOut: undefined,
      toLocal,
      pointer: undefined,
      handle: undefined,
    };
  }

  /**
   * Returns where a point pressed at the point goes: at a multiple of 45 degrees from the previous
   * point with Shift held, or snapped, unless Ctrl is held.
   */
  private place(point: Point, previous: Point | undefined, modifiers: Modifiers | undefined) {
    this.guides = [];
    if (modifiers?.shift && previous) {
      const delta = MathUtil.snapVectorToAngle(
        { x: point.x - previous.x, y: point.y - previous.y },
        ANGLE_SNAP,
      );
      const constrained = { x: previous.x + delta.x, y: previous.y + delta.y };
      return {
        point: modifiers.ctrl
          ? constrained
          : snapAlongLineToGrid(previous, constrained, this.context.getSnapThresholds().grid),
      };
    }
    if (modifiers?.ctrl) {
      return { point };
    }
    const snap = snapPoint(point, this.getSnapTargets(), this.context.getSnapThresholds());
    this.guides = snap.guides;
    return { point: { x: point.x + snap.dx, y: point.y + snap.dy } };
  }

  /** The artboard, the other paths' bounds, and the points of the path being drawn. */
  private getSnapTargets(): SnapTargets {
    const vl = this.context.getVectorLayer();
    const current = this.press ?? this.drawing;
    const targets = getSnapTargets(
      vl,
      current ? [current.layerId] : [],
      this.context.getHiddenLayerIds(),
      this.context.getGuides(),
    );
    const path = current && getLayerPath(vl, current.layerId);
    if (!current || !path) {
      return targets;
    }
    const toViewport = this.getToViewport(current.layerId);
    const x: SnapLine[] = [...targets.x];
    const y: SnapLine[] = [...targets.y];
    for (const anchor of PathEdit.getAnchors(path)) {
      const p = transform(anchor.point, toViewport);
      x.push({ value: p.x, from: p.y, to: p.y });
      y.push({ value: p.y, from: p.x, to: p.x });
    }
    return { x, y };
  }

  /** Whether the point is on the first point of the subpath being drawn, which closes it. */
  private isOverClose(point: Point | undefined) {
    const anchors = this.getDrawingAnchors();
    return !!anchors && anchors.length > 1 && this.isNear(point, anchors[0]);
  }

  /** Whether the point is on the last point of the subpath being drawn. */
  private isOverLast(point: Point | undefined) {
    const anchors = this.getDrawingAnchors();
    return !!anchors && anchors.length > 1 && this.isNear(point, anchors[anchors.length - 1]);
  }

  /** The points of the subpath being drawn, in viewport coordinates. */
  private getDrawingAnchors() {
    const { drawing } = this;
    const found = drawing && this.findDrawing(drawing);
    if (!drawing || !found) {
      return undefined;
    }
    const toViewport = this.getToViewport(drawing.layerId);
    const anchors = getSubPathAnchors(drawing.path, found.subIdx).map(p =>
      transform(p, toViewport),
    );
    // In the order the pen draws them.
    return found.isReversed ? anchors.reverse() : anchors;
  }

  private isNear(point: Point | undefined, anchor: Point) {
    return (
      !!point && MathUtil.distance(anchor, point) <= this.context.toViewportLength(POINT_HIT_RADIUS)
    );
  }

  /**
   * Returns where the subpath being drawn is now, and the point the pen draws on from, which undo
   * may have taken away, if it's still an open end.
   */
  private findDrawing(drawing: Drawing) {
    const ends = PathEdit.getSubPathEnds(drawing.path);
    let end = ends.find(e => e.anchorId === drawing.lastAnchorId);
    if (!end) {
      // The other end of the subpath that starts with the first point.
      const first = ends.find(e => e.anchorId === drawing.firstAnchorId);
      end = first && (ends.find(e => e.subIdx === first.subIdx && e !== first) ?? first);
    }
    return (
      end && {
        layerId: drawing.layerId,
        subIdx: end.subIdx,
        lastAnchorId: end.anchorId,
        isReversed: end.isStart,
      }
    );
  }

  /**
   * Forgets the drawing if something else changed it so that the pen can't go on: e.g. undo took
   * its points away, the layer was deleted, or an animation block now sets its path.
   */
  private sync() {
    const { drawing } = this;
    if (!drawing || this.press) {
      return;
    }
    const path = getLayerPath(this.context.getVectorLayer(), drawing.layerId);
    if (!path || !this.context.canEditPath(drawing.layerId)) {
      this.drawing = undefined;
      return;
    }
    if (path !== drawing.path) {
      // The handle that was pulled out may be for a point that's gone.
      this.drawing = { ...drawing, path, pendingOut: undefined };
    }
    const found = this.drawing && this.findDrawing(this.drawing);
    if (!this.drawing || !found) {
      this.drawing = undefined;
    } else if (
      found.lastAnchorId !== this.drawing.lastAnchorId ||
      found.isReversed !== this.drawing.isReversed
    ) {
      this.drawing = { ...this.drawing, ...found };
    }
  }

  private getToViewport(layerId: string) {
    return LayerUtil.getCanvasTransformForLayer(this.context.getVectorLayer(), layerId);
  }

  private getToLocal(layerId: string) {
    return this.getToViewport(layerId).invert() ?? Matrix.identity();
  }
}

function getSubPathAnchors(path: Path, subIdx: number) {
  return PathEdit.getAnchors(path)
    .filter(anchor => anchor.subIdx === subIdx)
    .map(anchor => anchor.point);
}

function transform(point: Point, matrix: Matrix) {
  return MathUtil.transformPoint(point, matrix);
}
