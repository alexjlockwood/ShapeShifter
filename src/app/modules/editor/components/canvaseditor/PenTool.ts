import { LayerUtil } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';

import { CanvasTool, DrawToolContext, ToolOverlay } from './drawTools';
import { addNewLayer, createPathLayer, getNewLayerParentId, getNewLayerToLocal } from './newLayers';
import { getLayerPath } from './PathEditTool';
import type { Modifiers } from './SelectTool';
import { getSnapTargets, SnapGuide, SnapLine, snapPoint, SnapTargets } from './snapping';

export interface PenToolContext extends DrawToolContext {
  /** The path whose points are being edited, which the pen adds subpaths to, if any. */
  readonly targetLayerId?: string;
}

/** The subpath that the pen is drawing, between presses. */
interface Drawing {
  readonly layerId: string;
  readonly subIdx: number;
  // The last point's handle for the next segment, in the layer's coordinates.
  readonly pendingOut: Point | undefined;
  // The path as the pen left it, to tell when something else, like undo, changes it.
  readonly path: Path;
}

interface Press {
  // Starting a subpath (or going on from the end of one), adding a point, or closing it.
  readonly kind: 'start' | 'append' | 'close';
  readonly start: Point;
  // Where the point went, in viewport coordinates.
  readonly anchor: Point;
  readonly layerId: string;
  readonly subIdx: number;
  // The path before an added point, or with the new subpath.
  readonly before: Path;
  readonly pendingOut: Point | undefined;
  readonly toLocal: Matrix;
  // The handle that a drag pulls out of the point, in viewport coordinates.
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
 * - Clicking the first point closes the path. Enter, Escape, or a double-click finish it open.
 * - Each point is one undo step. The first one makes a new stroked layer, in the selected group
 *   (see getNewLayerParentId), unless a path's points are being edited: then the pen adds a
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
    const current = press ?? drawing;
    const path = current && getLayerPath(this.context.getVectorLayer(), current.layerId);
    if (!current || !path) {
      return { curves: [], anchors: [], handles: [], guides: this.guides };
    }
    const toViewport = this.getToViewport(current.layerId);
    const anchors = getSubPathAnchors(path, current.subIdx).map(p => transform(p, toViewport));
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
    if (clickCount === 2 && this.drawing) {
      // The first click added the last point.
      this.finish();
      this.context.finish();
      return;
    }
    const { preview } = this.context;
    preview.begin(() => {
      this.press = undefined;
      this.context.redraw();
    });
    const base = preview.getBase();
    if (!base) {
      preview.cancel();
      return;
    }
    this.press = this.drawing
      ? this.pressWhileDrawing(point, this.drawing)
      : this.pressToStart(point);
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
    this.press = { ...press, handle };
    const local = transform(handle, press.toLocal);
    const anchor = transform(press.anchor, press.toLocal);
    // The handle into the point mirrors the one being pulled out, unless Alt breaks them.
    const c2 = modifiers.alt ? undefined : { x: 2 * anchor.x - local.x, y: 2 * anchor.y - local.y };
    if (press.kind === 'append') {
      const { path } = PathEdit.appendAnchor(press.before, press.subIdx, anchor, {
        c1: press.pendingOut,
        c2,
      });
      this.context.preview.setPath(press.layerId, path);
    } else if (press.kind === 'close') {
      this.context.preview.setPath(
        press.layerId,
        PathEdit.closeSubPath(press.before, press.subIdx, { c1: press.pendingOut, c2 }),
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
      subIdx: press.subIdx,
      pendingOut: press.handle && transform(press.handle, press.toLocal),
      path,
    };
    this.context.redraw();
  }

  onModifiersChange(modifiers: Modifiers) {
    this.modifiers = modifiers;
    const { press } = this;
    if (press?.handle) {
      this.onMove(press.handle, modifiers);
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
   * Stops drawing, with the subpath left open. A subpath with just its first point is deleted,
   * along with its layer if that's all it had.
   */
  finish() {
    this.onLeave();
    this.sync();
    const { drawing } = this;
    this.drawing = undefined;
    const path = drawing && getLayerPath(this.context.getVectorLayer(), drawing.layerId);
    if (!drawing || !path || PathEdit.getAnchorCount(path, drawing.subIdx) > 1) {
      return;
    }
    const { preview } = this.context;
    preview.begin(() => {});
    const base = preview.getBase();
    const [anchor] = PathEdit.getAnchors(path).filter(a => a.subIdx === drawing.subIdx);
    const remaining = anchor && PathEdit.deleteAnchors(path, new Set([anchor.id]));
    if (!base) {
      preview.cancel();
    } else if (remaining) {
      preview.setPath(drawing.layerId, remaining);
      preview.commit();
    } else {
      preview.setDocument(
        {
          vectorLayer: LayerUtil.removeLayers(base.vectorLayer, drawing.layerId),
          animation: base.animation,
        },
        { selectedLayerIds: new Set() },
      );
      preview.commit();
    }
  }

  /** Adds a point to the subpath being drawn, or closes it if its first point is pressed. */
  private pressWhileDrawing(point: Point, drawing: Drawing): Press | undefined {
    const { layerId, subIdx, pendingOut, path: before } = drawing;
    const toLocal = this.getToLocal(layerId);
    const anchors = getSubPathAnchors(before, subIdx).map(p =>
      transform(p, this.getToViewport(layerId)),
    );
    const press = { start: point, layerId, subIdx, before, pendingOut, toLocal, handle: undefined };
    if (this.isOverClose(point)) {
      this.context.preview.setPath(
        layerId,
        PathEdit.closeSubPath(before, subIdx, { c1: pendingOut }),
      );
      return { ...press, kind: 'close', anchor: anchors[0] };
    }
    const anchor = this.place(point, anchors[anchors.length - 1], this.modifiers).point;
    const { path } = PathEdit.appendAnchor(before, subIdx, transform(anchor, toLocal), {
      c1: pendingOut,
    });
    this.context.preview.setPath(layerId, path);
    return { ...press, kind: 'append', anchor };
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
      const toLocal = this.getToLocal(targetLayerId);
      const toViewport = this.getToViewport(targetLayerId);
      const radius = this.context.toViewportLength(POINT_HIT_RADIUS);
      const end = PathEdit.getSubPathEnds(targetPath).find(
        e => MathUtil.distance(transform(e.point, toViewport), point) <= radius,
      );
      const press = { start: point, layerId: targetLayerId, toLocal, handle: undefined };
      if (end) {
        // The pen draws on from the end, so a subpath's start is turned into its end.
        const path = end.isStart ? PathEdit.reverseSubPath(targetPath, end.subIdx) : targetPath;
        preview.setPath(targetLayerId, path);
        const anchor = transform(end.point, toViewport);
        return {
          ...press,
          kind: 'start',
          subIdx: end.subIdx,
          before: path,
          pendingOut: undefined,
          anchor,
        };
      }
      const anchor = this.place(point, undefined, this.modifiers).point;
      const { path, subIdx } = PathEdit.addSubPath(targetPath, transform(anchor, toLocal));
      preview.setPath(targetLayerId, path);
      return { ...press, kind: 'start', subIdx, before: path, pendingOut: undefined, anchor };
    }
    const parentId = getNewLayerParentId(base.vectorLayer, this.context.getSelectedLayerIds());
    const toLocal = getNewLayerToLocal(base, parentId, document => this.context.render(document));
    const anchor = this.place(point, undefined, this.modifiers).point;
    const { path } = PathEdit.addSubPath(undefined, transform(anchor, toLocal));
    const layer = createPathLayer(base.vectorLayer, 'path', path, 'stroked');
    preview.setDocument(addNewLayer(base, parentId, layer), {
      selectedLayerIds: new Set([layer.id]),
    });
    return {
      kind: 'start',
      start: point,
      anchor,
      layerId: layer.id,
      subIdx: 0,
      before: path,
      pendingOut: undefined,
      toLocal,
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
      return { point: { x: previous.x + delta.x, y: previous.y + delta.y } };
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
    const { drawing } = this;
    if (!point || !drawing) {
      return false;
    }
    const anchors = getSubPathAnchors(drawing.path, drawing.subIdx);
    const first = anchors[0];
    return (
      anchors.length > 1 &&
      MathUtil.distance(transform(first, this.getToViewport(drawing.layerId)), point) <=
        this.context.toViewportLength(POINT_HIT_RADIUS)
    );
  }

  /** Forgets the drawing if something else, like undo or deleting the layer, changed it. */
  private sync() {
    const { drawing } = this;
    if (!drawing || this.press) {
      return;
    }
    const path = getLayerPath(this.context.getVectorLayer(), drawing.layerId);
    const isOpen = path && PathEdit.getSubPathEnds(path).some(e => e.subIdx === drawing.subIdx);
    if (!path || !isOpen) {
      this.drawing = undefined;
    } else if (path !== drawing.path) {
      // The handle that was pulled out may be for a point that's gone.
      this.drawing = { ...drawing, path, pendingOut: undefined };
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
