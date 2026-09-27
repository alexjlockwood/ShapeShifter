import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import * as CanvasUtil from 'app/modules/editor/components/canvas/CanvasUtil';
import {
  getLayersBounds,
  isMorphableLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Point, Rect } from 'app/modules/editor/scripts/common';
import { getContext2d } from 'app/modules/editor/scripts/dom';

import type { ToolOverlay } from './drawTools';
import { formatGuideValue, GuideDrawing } from './GuideTool';
import type { Measurement } from './measuring';
import type { PathEditDrawing } from './PathEditTool';
import { getHandlePoint, getVisibleHandles, HANDLE_SIZE } from './selectionHandles';
import type { SnapGuide } from './snapping';

// Figma's blue, and line widths in CSS pixels.
const EDITOR_COLOR = '#0d99ff';
const MARQUEE_FILL = 'rgba(13, 153, 255, 0.1)';
const HANDLE_FILL = '#fff';
// Figma's snapping red, and a pink for the guides dragged out of the rulers, so they don't look like
// snaps.
const GUIDE_COLOR = '#f24822';
const GUIDE_LINE_WIDTH = 1;
const RULER_GUIDE_COLOR = '#f23fb4';
const ACTIVE_RULER_GUIDE_LINE_WIDTH = 2;
// The ticks at the ends of a gap or a measurement, and the labels, in CSS pixels.
const GAP_TICK_SIZE = 4;
const LABEL_FONT = '600 11px Roboto, Helvetica Neue, sans-serif';
const LABEL_HEIGHT = 16;
const LABEL_PADDING = 4;
const LABEL_OFFSET = 6;
const LABEL_TEXT_COLOR = '#fff';
// The pixel grid shows once the units are this far apart, in CSS pixels, as in Figma.
const PIXEL_GRID_MIN_SCALE = 8;
const PIXEL_GRID_COLOR = 'rgba(0, 0, 0, 0.1)';
const HOVER_LINE_WIDTH = 2;
const SELECTED_LINE_WIDTH = 1;
const BOUNDS_LINE_WIDTH = 1;
// The radii of a path's points and handles, and of the one a click would add, in CSS pixels.
const ANCHOR_RADIUS = 3.5;
const HOVERED_ANCHOR_RADIUS = 4.5;
const CONTROL_RADIUS = 3;
const INSERT_POINT_RADIUS = 3;
const CURVE_SNAP_SIZE = 4;

export interface EditorDrawing {
  readonly vectorLayer: VectorLayer;
  readonly hoveredLayerId: string | undefined;
  readonly selectedLayerIds: ReadonlySet<string>;
  readonly isShowingHandles: boolean;
  readonly marquee: Rect | undefined;
  readonly guides: ReadonlyArray<SnapGuide>;
  /** The points of the path being edited, which replace the selection's bounds. */
  readonly pathEdit?: PathEditDrawing;
  /** What a drawing tool shows while it draws. */
  readonly overlay?: ToolOverlay;
  /** The guides dragged out of the rulers, when they're showing. */
  readonly rulerGuides?: GuideDrawing;
  /** Distances from the selection to a target, while Alt is held. */
  readonly measurements?: { readonly target: Rect; readonly items: ReadonlyArray<Measurement> };
  readonly showsPixelGrid?: boolean;
}

interface Label {
  readonly point: Point;
  readonly text: string;
  readonly color: string;
}

/** Draws the editor's outlines, bounds, and marquee on its own canvas, over the others. */
export class EditorRenderer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  setCamera(camera: CanvasCamera) {
    CanvasUtil.setCanvasSize(this.canvas, camera);
  }

  clear() {
    getContext2d(this.canvas).clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(camera: CanvasCamera, drawing: EditorDrawing) {
    this.clear();
    const ctx = getContext2d(this.canvas);
    ctx.save();
    const { a, b, c, d, e, f } = camera.getDeviceTransform();
    ctx.setTransform(a, b, c, d, e, f);
    // Line widths are in viewport units under the transform.
    const toViewport = (length: number) => camera.toViewportLength(length);

    const {
      vectorLayer,
      hoveredLayerId,
      selectedLayerIds,
      isShowingHandles,
      marquee,
      guides,
      pathEdit,
      overlay,
      rulerGuides,
      measurements,
      showsPixelGrid,
    } = drawing;
    // Labels are drawn last, at a fixed size, in panel coordinates.
    const labels: Label[] = [];
    if (showsPixelGrid && camera.scale >= PIXEL_GRID_MIN_SCALE) {
      drawPixelGrid(ctx, camera, vectorLayer);
    }
    if (rulerGuides) {
      drawRulerGuides(ctx, camera, rulerGuides, labels);
    }
    const outline = (layerId: string, lineWidth: number) => {
      const layer = vectorLayer.findLayerById(layerId);
      if (isMorphableLayer(layer) && layer.pathData) {
        const transform = LayerUtil.getCanvasTransformForLayer(vectorLayer, layer.id);
        CanvasUtil.executeCommands(ctx, layer.pathData.getCommands(), transform);
        ctx.strokeStyle = EDITOR_COLOR;
        ctx.lineWidth = toViewport(lineWidth);
        ctx.stroke();
      }
    };
    selectedLayerIds.forEach(layerId => outline(layerId, SELECTED_LINE_WIDTH));
    if (hoveredLayerId && !selectedLayerIds.has(hoveredLayerId)) {
      outline(hoveredLayerId, HOVER_LINE_WIDTH);
    }

    // The points being edited, or a drawing tool's overlay, replace the selection's bounds.
    const bounds = pathEdit || overlay ? undefined : getLayersBounds(vectorLayer, selectedLayerIds);
    if (pathEdit) {
      drawPathEdit(ctx, pathEdit, toViewport);
    }
    if (overlay) {
      drawOverlay(ctx, overlay, toViewport);
    }
    if (bounds) {
      ctx.beginPath();
      ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
      ctx.strokeStyle = EDITOR_COLOR;
      ctx.lineWidth = toViewport(BOUNDS_LINE_WIDTH);
      ctx.stroke();
      if (isShowingHandles) {
        const size = toViewport(HANDLE_SIZE);
        for (const handle of getVisibleHandles(bounds, toViewport)) {
          const { x, y } = getHandlePoint(bounds, handle);
          ctx.beginPath();
          ctx.rect(x - size / 2, y - size / 2, size, size);
          ctx.fillStyle = HANDLE_FILL;
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = toViewport(GUIDE_LINE_WIDTH);
    for (const { axis, value, from, to, isGap } of guides) {
      if (isGap) {
        // A gap that's the same as the others, measured along the other axis.
        drawDistance(ctx, axis === 'x' ? 'y' : 'x', from, to, value, toViewport);
        labels.push({
          point: axis === 'x' ? { x: value, y: (from + to) / 2 } : { x: (from + to) / 2, y: value },
          text: formatGuideValue(to - from),
          color: GUIDE_COLOR,
        });
        continue;
      }
      ctx.beginPath();
      if (axis === 'x') {
        ctx.moveTo(value, from);
        ctx.lineTo(value, to);
      } else {
        ctx.moveTo(from, value);
        ctx.lineTo(to, value);
      }
      ctx.stroke();
    }

    if (measurements) {
      drawMeasurements(ctx, measurements.target, measurements.items, toViewport, labels);
    }

    if (marquee) {
      ctx.beginPath();
      ctx.rect(marquee.l, marquee.t, marquee.r - marquee.l, marquee.b - marquee.t);
      ctx.fillStyle = MARQUEE_FILL;
      ctx.fill();
      ctx.strokeStyle = EDITOR_COLOR;
      ctx.lineWidth = toViewport(BOUNDS_LINE_WIDTH);
      ctx.stroke();
    }
    ctx.restore();
    drawLabels(ctx, camera, labels);
  }
}

/** Draws a line between the units of the artboard, over the paths. */
function drawPixelGrid(ctx: CanvasRenderingContext2D, camera: CanvasCamera, vl: VectorLayer) {
  const { l, t, r, b } = getVisibleRect(camera);
  const left = Math.max(0, Math.ceil(l));
  const top = Math.max(0, Math.ceil(t));
  const right = Math.min(vl.width, Math.floor(r));
  const bottom = Math.min(vl.height, Math.floor(b));
  ctx.beginPath();
  for (let x = left; x <= right; x++) {
    ctx.moveTo(x, Math.max(0, t));
    ctx.lineTo(x, Math.min(vl.height, b));
  }
  for (let y = top; y <= bottom; y++) {
    ctx.moveTo(Math.max(0, l), y);
    ctx.lineTo(Math.min(vl.width, r), y);
  }
  ctx.strokeStyle = PIXEL_GRID_COLOR;
  // A device pixel wide.
  ctx.lineWidth = camera.toViewportLength(1 / camera.pixelRatio);
  ctx.stroke();
}

/** Draws the guides across the whole panel, with the one being dragged labeled. */
function drawRulerGuides(
  ctx: CanvasRenderingContext2D,
  camera: CanvasCamera,
  { guides, activeGuideId, label }: GuideDrawing,
  labels: Label[],
) {
  const { l, t, r, b } = getVisibleRect(camera);
  ctx.strokeStyle = RULER_GUIDE_COLOR;
  for (const { id, axis, value } of guides) {
    ctx.beginPath();
    if (axis === 'x') {
      ctx.moveTo(value, t);
      ctx.lineTo(value, b);
    } else {
      ctx.moveTo(l, value);
      ctx.lineTo(r, value);
    }
    ctx.lineWidth = camera.toViewportLength(
      id === activeGuideId ? ACTIVE_RULER_GUIDE_LINE_WIDTH : GUIDE_LINE_WIDTH,
    );
    ctx.stroke();
  }
  if (label) {
    labels.push({ ...label, color: RULER_GUIDE_COLOR });
  }
}

/** Draws the distances to the target, which is outlined, and dashes where they miss it. */
function drawMeasurements(
  ctx: CanvasRenderingContext2D,
  target: Rect,
  measurements: ReadonlyArray<Measurement>,
  toViewport: (length: number) => number,
  labels: Label[],
) {
  ctx.strokeStyle = GUIDE_COLOR;
  ctx.lineWidth = toViewport(GUIDE_LINE_WIDTH);
  ctx.beginPath();
  ctx.rect(target.l, target.t, target.r - target.l, target.b - target.t);
  ctx.stroke();
  for (const { axis, from, to, at, extension } of measurements) {
    drawDistance(ctx, axis, from, to, at, toViewport);
    labels.push({
      point: axis === 'x' ? { x: (from + to) / 2, y: at } : { x: at, y: (from + to) / 2 },
      text: formatGuideValue(to - from),
      color: GUIDE_COLOR,
    });
    if (extension) {
      ctx.save();
      ctx.setLineDash([toViewport(2), toViewport(2)]);
      ctx.beginPath();
      if (axis === 'x') {
        ctx.moveTo(extension.at, extension.from);
        ctx.lineTo(extension.at, extension.to);
      } else {
        ctx.moveTo(extension.from, extension.at);
        ctx.lineTo(extension.to, extension.at);
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Draws a distance along the axis, from one value to another, at a position across it, with a
 * tick at each end.
 */
function drawDistance(
  ctx: CanvasRenderingContext2D,
  axis: 'x' | 'y',
  from: number,
  to: number,
  at: number,
  toViewport: (length: number) => number,
) {
  const tick = toViewport(GAP_TICK_SIZE) / 2;
  ctx.beginPath();
  if (axis === 'x') {
    ctx.moveTo(from, at);
    ctx.lineTo(to, at);
    ctx.moveTo(from, at - tick);
    ctx.lineTo(from, at + tick);
    ctx.moveTo(to, at - tick);
    ctx.lineTo(to, at + tick);
  } else {
    ctx.moveTo(at, from);
    ctx.lineTo(at, to);
    ctx.moveTo(at - tick, from);
    ctx.lineTo(at + tick, from);
    ctx.moveTo(at - tick, to);
    ctx.lineTo(at + tick, to);
  }
  ctx.stroke();
}

/** Draws each label as a pill a little below and to the right of its point. */
function drawLabels(ctx: CanvasRenderingContext2D, camera: CanvasCamera, labels: Label[]) {
  if (!labels.length) {
    return;
  }
  ctx.save();
  const { pixelRatio } = camera;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { point, text, color } of labels) {
    const { x, y } = camera.viewportToPanel(point);
    const width = ctx.measureText(text).width + 2 * LABEL_PADDING;
    const left = x - width / 2;
    const top = y + LABEL_OFFSET;
    ctx.beginPath();
    ctx.roundRect(left, top, width, LABEL_HEIGHT, 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = LABEL_TEXT_COLOR;
    ctx.fillText(text, x, top + LABEL_HEIGHT / 2);
  }
  ctx.restore();
}

/** The part of the viewport that the panel shows. */
function getVisibleRect(camera: CanvasCamera): Rect {
  const topLeft = camera.panelToViewport({ x: 0, y: 0 });
  const bottomRight = camera.panelToViewport({ x: camera.panel.w, y: camera.panel.h });
  return { l: topLeft.x, t: topLeft.y, r: bottomRight.x, b: bottomRight.y };
}

function drawPathEdit(
  ctx: CanvasRenderingContext2D,
  drawing: PathEditDrawing,
  toViewport: (length: number) => number,
) {
  const { hoveredSegment, handles, anchors, insertPoint } = drawing;
  const circle = (x: number, y: number, radius: number, fill: string, stroke: string) => {
    ctx.beginPath();
    ctx.arc(x, y, toViewport(radius), 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = toViewport(SELECTED_LINE_WIDTH);
    ctx.stroke();
  };
  if (hoveredSegment) {
    const [start, ...rest] = hoveredSegment;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    if (rest.length === 3) {
      ctx.bezierCurveTo(rest[0].x, rest[0].y, rest[1].x, rest[1].y, rest[2].x, rest[2].y);
    } else if (rest.length === 2) {
      ctx.quadraticCurveTo(rest[0].x, rest[0].y, rest[1].x, rest[1].y);
    } else {
      ctx.lineTo(rest[0].x, rest[0].y);
    }
    ctx.strokeStyle = EDITOR_COLOR;
    ctx.lineWidth = toViewport(HOVER_LINE_WIDTH);
    ctx.stroke();
  }
  for (const { anchor, handle } of handles) {
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.strokeStyle = EDITOR_COLOR;
    ctx.lineWidth = toViewport(SELECTED_LINE_WIDTH);
    ctx.stroke();
  }
  for (const { handle, isHovered } of handles) {
    circle(
      handle.x,
      handle.y,
      CONTROL_RADIUS,
      isHovered ? EDITOR_COLOR : HANDLE_FILL,
      EDITOR_COLOR,
    );
  }
  for (const { point, isSelected, isHovered } of anchors) {
    circle(
      point.x,
      point.y,
      isHovered ? HOVERED_ANCHOR_RADIUS : ANCHOR_RADIUS,
      isSelected ? EDITOR_COLOR : HANDLE_FILL,
      isSelected ? HANDLE_FILL : EDITOR_COLOR,
    );
  }
  if (insertPoint) {
    circle(insertPoint.x, insertPoint.y, INSERT_POINT_RADIUS, EDITOR_COLOR, EDITOR_COLOR);
  }
  if (drawing.curveSnap) {
    // A cross, like the guides, where the point snapped onto a curve.
    const { x, y } = drawing.curveSnap;
    const size = toViewport(CURVE_SNAP_SIZE);
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x - size, y + size);
    ctx.lineTo(x + size, y - size);
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = toViewport(GUIDE_LINE_WIDTH);
    ctx.stroke();
  }
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: ToolOverlay,
  toViewport: (length: number) => number,
) {
  ctx.strokeStyle = EDITOR_COLOR;
  ctx.lineWidth = toViewport(SELECTED_LINE_WIDTH);
  for (const [start, ...rest] of overlay.curves) {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    if (rest.length === 3) {
      ctx.bezierCurveTo(rest[0].x, rest[0].y, rest[1].x, rest[1].y, rest[2].x, rest[2].y);
    } else {
      rest.forEach(p => ctx.lineTo(p.x, p.y));
    }
    ctx.stroke();
  }
  for (const { anchor, handle } of overlay.handles) {
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, toViewport(CONTROL_RADIUS), 0, 2 * Math.PI);
    ctx.fillStyle = HANDLE_FILL;
    ctx.fill();
    ctx.stroke();
  }
  for (const { point, isHovered } of overlay.anchors) {
    ctx.beginPath();
    ctx.arc(
      point.x,
      point.y,
      toViewport(isHovered ? HOVERED_ANCHOR_RADIUS : ANCHOR_RADIUS),
      0,
      2 * Math.PI,
    );
    ctx.fillStyle = isHovered ? EDITOR_COLOR : HANDLE_FILL;
    ctx.fill();
    ctx.stroke();
  }
}
