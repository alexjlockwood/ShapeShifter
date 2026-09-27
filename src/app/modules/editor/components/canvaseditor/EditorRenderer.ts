import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import * as CanvasUtil from 'app/modules/editor/components/canvas/CanvasUtil';
import {
  getLayersBounds,
  isMorphableLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Rect } from 'app/modules/editor/scripts/common';
import { getContext2d } from 'app/modules/editor/scripts/dom';

import type { PathEditDrawing } from './PathEditTool';
import { getHandlePoint, getVisibleHandles, HANDLE_SIZE } from './selectionHandles';
import type { SnapGuide } from './snapping';

// Figma's blue, and line widths in CSS pixels.
const EDITOR_COLOR = '#0d99ff';
const MARQUEE_FILL = 'rgba(13, 153, 255, 0.1)';
const HANDLE_FILL = '#fff';
// Figma's snapping red.
const GUIDE_COLOR = '#f24822';
const GUIDE_LINE_WIDTH = 1;
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
    } = drawing;
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

    const bounds = pathEdit ? undefined : getLayersBounds(vectorLayer, selectedLayerIds);
    if (pathEdit) {
      drawPathEdit(ctx, pathEdit, toViewport);
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

    for (const { axis, value, from, to } of guides) {
      ctx.beginPath();
      if (axis === 'x') {
        ctx.moveTo(value, from);
        ctx.lineTo(value, to);
      } else {
        ctx.moveTo(from, value);
        ctx.lineTo(to, value);
      }
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = toViewport(GUIDE_LINE_WIDTH);
      ctx.stroke();
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
  }
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
