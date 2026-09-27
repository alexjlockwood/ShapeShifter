import type { CanvasCamera } from 'app/modules/editor/components/canvas/CanvasCamera';
import * as CanvasUtil from 'app/modules/editor/components/canvas/CanvasUtil';
import {
  getLayersBounds,
  isMorphableLayer,
} from 'app/modules/editor/components/canvas/LayerGeometry';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Rect } from 'app/modules/editor/scripts/common';
import { getContext2d } from 'app/modules/editor/scripts/dom';

// Figma's blue, and line widths in CSS pixels.
const EDITOR_COLOR = '#0d99ff';
const MARQUEE_FILL = 'rgba(13, 153, 255, 0.1)';
const HOVER_LINE_WIDTH = 2;
const SELECTED_LINE_WIDTH = 1;
const BOUNDS_LINE_WIDTH = 1;

export interface EditorDrawing {
  readonly vectorLayer: VectorLayer;
  readonly hoveredLayerId: string | undefined;
  readonly selectedLayerIds: ReadonlySet<string>;
  readonly marquee: Rect | undefined;
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

    const { vectorLayer, hoveredLayerId, selectedLayerIds, marquee } = drawing;
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

    const bounds = getLayersBounds(vectorLayer, selectedLayerIds);
    if (bounds) {
      ctx.beginPath();
      ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
      ctx.strokeStyle = EDITOR_COLOR;
      ctx.lineWidth = toViewport(BOUNDS_LINE_WIDTH);
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
