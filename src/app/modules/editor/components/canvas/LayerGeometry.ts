import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Matrix, Point, Rect } from 'app/modules/editor/scripts/common';

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
 * them, and strokes by the width they're drawn at. Only if nothing is hit that way, anything within
 * the tolerance of a path's outline counts, so thin and unfilled paths can be clicked, without a
 * near miss on a layer beating a hit on the one under it. Clip paths are only hit by their outline.
 */
export function hitTestLayer(vl: VectorLayer, point: Point, opts: HitTestOptions) {
  const hiddenLayerIds = opts.hiddenLayerIds ?? new Set<string>();
  const paths: { layer: MorphableLayer; path: Path2D; matrix: Matrix }[] = [];
  (function recurseFn(layer: Layer, matrix: Matrix) {
    if (hiddenLayerIds.has(layer.id)) {
      return;
    }
    const layerMatrix = getLayerMatrix(layer, matrix);
    if (isMorphableLayer(layer)) {
      // A group scaled to 0 collapses its paths to lines, which shouldn't be clickable.
      if (layer.pathData && layer.pathData.getCommands().length && layerMatrix.invert()) {
        paths.push({
          layer,
          path: toViewportPath(layer.pathData.getPathString(), layerMatrix),
          matrix: layerMatrix,
        });
      }
      return;
    }
    layer.children.forEach(child => recurseFn(child, layerMatrix));
  })(vl, Matrix.identity());
  // Later layers are drawn on top.
  paths.reverse();
  const ctx = getHitTestContext();
  const { x, y } = point;
  const exactHit = paths.find(({ layer, path, matrix }) => {
    if (layer instanceof ClipPathLayer) {
      return false;
    }
    const fillRule = layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero';
    if (layer.isFilled() && ctx.isPointInPath(path, x, y, fillRule)) {
      return true;
    }
    if (!layer.isStroked() || !layer.strokeWidth) {
      return false;
    }
    // Like CanvasLayers, which scales the width by the inverse matrix (see BUGS.md).
    const inverse = matrix.invert();
    ctx.lineWidth = layer.strokeWidth * (inverse ? inverse.getScaleFactor() : 1);
    ctx.lineCap = layer.strokeLinecap;
    ctx.lineJoin = layer.strokeLinejoin;
    return ctx.isPointInStroke(path, x, y);
  });
  if (exactHit) {
    return exactHit.layer;
  }
  // The tolerance is in viewport units, like the path now is, so it's the same on the screen
  // inside of scaled groups (CANVAS-3).
  ctx.lineWidth = opts.tolerance * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return paths.find(({ path }) => ctx.isPointInStroke(path, x, y))?.layer;
}

/** Returns the path in viewport coordinates, as a Path2D. */
function toViewportPath(pathData: string, matrix: Matrix) {
  const { a, b, c, d, e, f } = matrix;
  const path = new Path2D();
  path.addPath(new Path2D(pathData), new DOMMatrix([a, b, c, d, e, f]));
  return path;
}

/**
 * Returns the matrix from the layer's coordinates to the viewport's, from its parent's: a group's
 * for its children, and a path's for its path.
 */
function getLayerMatrix(layer: Layer, parentMatrix: Matrix) {
  const transforms = LayerUtil.getLayerTransforms(layer);
  return transforms.length ? Matrix.flatten([parentMatrix, ...transforms]) : parentMatrix;
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
  (function recurseFn(current: Layer, parentMatrix: Matrix) {
    const matrix = getLayerMatrix(current, parentMatrix);
    if (isMorphableLayer(current)) {
      const box = getPathBounds(current, matrix);
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
    current.children.forEach(child => recurseFn(child, matrix));
  })(layer, LayerUtil.getParentTransformForLayer(vl, layerId));
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

function getPathBounds(layer: MorphableLayer, matrix: Matrix): Rect | undefined {
  // Without Path.transform's clone, which prints and parses the path again.
  const box = layer.pathData?.mutate().transform(matrix).build().getBoundingBox();
  return box && [box.l, box.t, box.r, box.b].every(Number.isFinite) ? box : undefined;
}

/**
 * Returns the bounds of every visible path layer (not clip paths) in viewport coordinates, in one
 * walk over the tree, e.g. for a marquee to test.
 */
export function getPathLayerBounds(vl: VectorLayer, hiddenLayerIds: ReadonlySet<string>) {
  const bounds = new Map<string, Rect>();
  (function recurseFn(layer: Layer, parentMatrix: Matrix) {
    if (hiddenLayerIds.has(layer.id)) {
      return;
    }
    const matrix = getLayerMatrix(layer, parentMatrix);
    if (layer instanceof PathLayer) {
      const box = getPathBounds(layer, matrix);
      if (box) {
        bounds.set(layer.id, box);
      }
      return;
    }
    layer.children.forEach(child => recurseFn(child, matrix));
  })(vl, Matrix.identity());
  return bounds;
}
