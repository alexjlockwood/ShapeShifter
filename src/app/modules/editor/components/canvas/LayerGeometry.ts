import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { MathUtil, Matrix, Point, Rect } from 'app/modules/editor/scripts/common';

export type MorphableLayer = PathLayer | ClipPathLayer;

export interface HitTestOptions {
  readonly hiddenLayerIds?: ReadonlySet<string>;
  /** How far from a path's outline still hits it, in viewport units. */
  readonly tolerance: number;
}

let hitTestContext: CanvasRenderingContext2D | undefined;

// A canvas that's never shown, for isPointInPath and isPointInStroke.
function getHitTestContext() {
  if (!hitTestContext) {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) {
      throw new Error("Couldn't get a canvas context to hit test with");
    }
    hitTestContext = ctx;
  }
  return hitTestContext;
}

export function isMorphableLayer(layer: Layer | undefined): layer is MorphableLayer {
  return layer instanceof PathLayer || layer instanceof ClipPathLayer;
}

/**
 * Returns the topmost path or clip path at the point, in viewport coordinates, like the canvas
 * draws them. Fills are hit by their fill rule, with open subpaths closed the way the fill closes
 * them, and strokes by their width. Anything within the tolerance of a path's outline counts too,
 * so thin and unfilled paths can be clicked, and clip paths are only hit by their outline.
 */
export function hitTestLayer(vl: VectorLayer, point: Point, opts: HitTestOptions) {
  const hiddenLayerIds = opts.hiddenLayerIds ?? new Set<string>();
  return (function recurseFn(layer: Layer, matrix: Matrix): MorphableLayer | undefined {
    if (hiddenLayerIds.has(layer.id)) {
      return undefined;
    }
    if (isMorphableLayer(layer)) {
      return isLayerHit(layer, matrix, point, opts.tolerance) ? layer : undefined;
    }
    const childMatrix = getChildMatrix(layer, matrix);
    // Later children are drawn on top.
    for (let i = layer.children.length - 1; i >= 0; i--) {
      const hit = recurseFn(layer.children[i], childMatrix);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  })(vl, Matrix.identity());
}

function isLayerHit(layer: MorphableLayer, matrix: Matrix, point: Point, tolerance: number) {
  const inverse = matrix.invert();
  if (!layer.pathData || !layer.pathData.getCommands().length || !inverse) {
    // A group scaled to 0 has no inverse, and nothing to hit.
    return false;
  }
  const { x, y } = MathUtil.transformPoint(point, inverse);
  const path = new Path2D(layer.pathData.getPathString());
  const ctx = getHitTestContext();
  if (layer instanceof PathLayer && layer.isFilled()) {
    const fillRule = layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero';
    if (ctx.isPointInPath(path, x, y, fillRule)) {
      return true;
    }
  }
  // The tolerance is in viewport units, and the layer's own units can be scaled (CANVAS-3).
  const scale = matrix.getScaleFactor() || 1;
  const strokeWidth = layer instanceof PathLayer && layer.isStroked() ? layer.strokeWidth : 0;
  ctx.lineWidth = Math.max(strokeWidth, (tolerance * 2) / scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx.isPointInStroke(path, x, y);
}

/** Returns the layer's transform for its children, from its own transform. */
function getChildMatrix(layer: Layer, matrix: Matrix) {
  return layer instanceof GroupLayer
    ? Matrix.flatten([matrix, ...LayerUtil.getCanvasTransformsForGroupLayer(layer)])
    : matrix;
}

/**
 * Returns the bounds of the layer's paths in viewport coordinates, without their strokes, or
 * undefined if it has no paths. They're tight, even for rotated groups and curves.
 */
export function getLayerBounds(vl: VectorLayer, layerId: string): Rect | undefined {
  const layer = vl.findLayerById(layerId);
  if (!layer) {
    return undefined;
  }
  let bounds: { l: number; t: number; r: number; b: number } | undefined;
  (function recurseFn(current: Layer, matrix: Matrix) {
    if (isMorphableLayer(current)) {
      const box = current.pathData?.transform(matrix).getBoundingBox();
      if (box && [box.l, box.t, box.r, box.b].every(Number.isFinite)) {
        bounds = bounds
          ? {
              l: Math.min(bounds.l, box.l),
              t: Math.min(bounds.t, box.t),
              r: Math.max(bounds.r, box.r),
              b: Math.max(bounds.b, box.b),
            }
          : { ...box };
      }
      return;
    }
    const childMatrix = getChildMatrix(current, matrix);
    current.children.forEach(child => recurseFn(child, childMatrix));
  })(layer, LayerUtil.getCanvasTransformForLayer(vl, layerId));
  return bounds;
}

/** Returns the bounds of all of the layers, or undefined if none of them have paths. */
export function getLayersBounds(vl: VectorLayer, layerIds: Iterable<string>): Rect | undefined {
  let bounds: Rect | undefined;
  for (const layerId of layerIds) {
    const box = getLayerBounds(vl, layerId);
    if (box) {
      bounds = bounds
        ? {
            l: Math.min(bounds.l, box.l),
            t: Math.min(bounds.t, box.t),
            r: Math.max(bounds.r, box.r),
            b: Math.max(bounds.b, box.b),
          }
        : box;
    }
  }
  return bounds;
}
