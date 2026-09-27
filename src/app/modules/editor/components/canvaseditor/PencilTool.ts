import { MathUtil, Point } from 'app/modules/editor/scripts/common';

import { CanvasTool, DrawToolContext, EMPTY_OVERLAY, ToolOverlay } from './drawTools';
import { fitCurves } from './fitCurves';
import { addNewLayer, createPathLayer, getNewLayerPlace, toLocalPath } from './newLayers';
import type { Modifiers } from './SelectTool';

// How far the pointer has to move to add a point, and how far the curves can stray from the
// points, in CSS pixels.
const MIN_POINT_DISTANCE = 1;
const MAX_FIT_ERROR = 2;
// How long a stroke has to be to draw a path, in CSS pixels, so that a click doesn't.
const MIN_STROKE_LENGTH = 4;

/**
 * Draws freehand, like Figma's pencil. The pointer's path is fitted with smooth cubic curves when
 * it's released, and becomes a new stroked layer (see getNewLayerSpot), which is selected. The
 * pencil stays on, for the next stroke.
 */
export class PencilTool implements CanvasTool {
  private points: Point[] | undefined;

  constructor(private readonly context: DrawToolContext) {}

  getOverlay(): ToolOverlay {
    const { points } = this;
    return {
      ...EMPTY_OVERLAY,
      curves: points ? points.slice(1).map((p, i) => [points[i], p]) : [],
    };
  }

  onPress(point: Point, _: Modifiers) {
    this.points = [point];
  }

  onMove(point: Point, _: Modifiers) {
    const { points } = this;
    if (!points) {
      return;
    }
    const last = points[points.length - 1];
    if (MathUtil.distance(last, point) >= this.context.toViewportLength(MIN_POINT_DISTANCE)) {
      points.push(point);
      this.context.redraw();
    }
  }

  onRelease(point: Point) {
    const { points } = this;
    this.points = undefined;
    if (!points) {
      return;
    }
    points.push(point);
    const length = points.slice(1).reduce((sum, p, i) => sum + MathUtil.distance(points[i], p), 0);
    const curves = fitCurves(points, this.context.toViewportLength(MAX_FIT_ERROR));
    if (length < this.context.toViewportLength(MIN_STROKE_LENGTH) || !curves.length) {
      this.context.redraw();
      return;
    }
    const { preview } = this.context;
    preview.begin(() => {});
    const base = preview.getBase();
    if (!base) {
      preview.cancel();
      return;
    }
    const place = getNewLayerPlace(
      base,
      this.context.getSelectedLayerIds(),
      this.context.getHiddenLayerIds(),
      document => this.context.render(document),
    );
    const pathData = toLocalPath(place.toLocal, [
      ['M', curves[0][0]],
      ...curves.map(([, c1, c2, end]) => ['C', c1, c2, end] as [string, Point, Point, Point]),
    ]);
    const layer = createPathLayer(base.vectorLayer, 'path', pathData, 'stroked', place);
    preview.setDocument(addNewLayer(base, place, layer), {
      selectedLayerIds: new Set([layer.id]),
    });
    preview.commit();
  }

  onModifiersChange(_: Modifiers) {}

  onLeave() {
    this.points = undefined;
    this.context.redraw();
  }
}
