import {
  ClipPathLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import type { Command, Path } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, Point, Rect } from 'app/modules/editor/scripts/common';
import { uniqWith } from 'lodash-es';

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

// The last bounds of each path, and the matrix they were transformed by. Paths are immutable, and
// the rendered vector layer shares the ones that aren't animated, so while the time changes, only
// the animated paths (or those in animated groups) are bounded again.
const pathBoundsCache = new WeakMap<Path, { matrix: Matrix; box: Rect | undefined }>();

/**
 * Returns the bounds of the path's drawn commands, transformed by the matrix. The inspector's
 * Layout section asks for them whenever the time changes, so this transforms the points of each
 * command and bounds the result, rather than building a transformed Path, which costs far more
 * (see BezierCalculator). An affine transform of a curve's control points gives the transformed
 * curve, so the bounds match the transformed path's getBoundingBox, to within the 9 decimals that
 * drawn commands are rounded to (getBoundingBox bounds the commands as they were parsed).
 */
function getPathBounds(layer: MorphableLayer, matrix: Matrix): Rect | undefined {
  const path = layer.pathData;
  if (!path) {
    return undefined;
  }
  const cached = pathBoundsCache.get(path);
  if (cached && isSameMatrix(cached.matrix, matrix)) {
    return cached.box;
  }
  const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (const command of path.getCommands()) {
    // Like MoveCalculator, whose bounds are empty.
    if (command.type !== 'M') {
      expandCommandBounds(box, command, matrix);
    }
  }
  const result = [box.l, box.t, box.r, box.b].every(Number.isFinite) ? box : undefined;
  pathBoundsCache.set(path, { matrix, box: result });
  return result;
}

/** Exactly, unlike Matrix.equals, so that a cached box is only used for the same numbers. */
function isSameMatrix(m1: Matrix, m2: Matrix) {
  return (
    m1 === m2 ||
    (m1.a === m2.a &&
      m1.b === m2.b &&
      m1.c === m2.c &&
      m1.d === m2.d &&
      m1.e === m2.e &&
      m1.f === m2.f)
  );
}

type MutableRect = { l: number; t: number; r: number; b: number };

/** Expands the box by the command's bounds, the way newCalculator's calculators bound it. */
function expandCommandBounds(box: MutableRect, command: Command, matrix: Matrix) {
  // Only a move can be missing its start point. The points are rounded like a transformed
  // command's (MathUtil.transformPoint), which e.g. keeps a line turned a quarter turn exactly
  // vertical, with a width of 0.
  const points = command.points
    .filter((p): p is Point => !!p)
    .map(p => MathUtil.transformPoint(p, matrix));
  const numUniquePoints = uniqWith(points, arePointsEqual).length;
  if (numUniquePoints === 1) {
    expandBounds(box, points[0].x, points[0].y);
  } else if (command.type === 'L' || command.type === 'Z' || numUniquePoints === 2) {
    const last = points[points.length - 1];
    expandBounds(box, points[0].x, points[0].y);
    expandBounds(box, last.x, last.y);
  } else if (command.type === 'Q' || command.type === 'C') {
    expandCurveBounds(box, points);
  }
}

/**
 * MathUtil.arePointsEqual, which rounds their distance to 9 decimals, but without rounding points
 * that are clearly apart, since lodash's round is slow.
 */
function arePointsEqual(p1: Point, p2: Point) {
  return (
    Math.abs(p1.x - p2.x) < 1e-9 && Math.abs(p1.y - p2.y) < 1e-9 && MathUtil.arePointsEqual(p1, p2)
  );
}

/** Like PathState's createBoundingBox, which skips NaN. */
function expandBounds(box: MutableRect, x: number, y: number) {
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return;
  }
  box.l = Math.min(x, box.l);
  box.t = Math.min(y, box.t);
  box.r = Math.max(x, box.r);
  box.b = Math.max(y, box.b);
}

/**
 * Expands the box by a quadratic or cubic curve's bounds, computed the way bezier-js's bbox is
 * (which BezierCalculator uses), so the numbers are the same: the curve is evaluated at its ends
 * and at the roots of its derivatives in each dimension.
 */
function expandCurveBounds(box: MutableRect, points: readonly Point[]) {
  const x = getCurveRange(points.map(p => p.x));
  const y = getCurveRange(points.map(p => p.y));
  // Each corner, like PathState's createBoundingBox.
  expandBounds(box, x.min, y.min);
  expandBounds(box, x.max, y.min);
  expandBounds(box, x.min, y.max);
  expandBounds(box, x.max, y.max);
}

/** Returns the smallest and largest values that one dimension of the curve takes. */
function getCurveRange(values: readonly number[]) {
  const first = derive(values);
  // bezier-js's extrema also takes a cubic's second derivative's roots, which can't change the
  // range, but they're kept so the comparisons below run the same way.
  const roots = getDerivativeRoots(first);
  if (values.length === 4) {
    roots.push(...getDerivativeRoots(derive(first)));
  }
  const ts = roots.filter(t => t >= 0 && t <= 1).sort((a, b) => a - b);
  if (!ts.includes(0)) {
    ts.unshift(0);
  }
  if (!ts.includes(1)) {
    ts.push(1);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const t of ts) {
    const v = evaluateCurve(values, t);
    if (v < min) {
      min = v;
    }
    if (v > max) {
      max = v;
    }
  }
  return { min, max };
}

/** Returns the Bernstein coefficients of the curve's derivative, like bezier-js's dpoints. */
function derive(values: readonly number[]) {
  const order = values.length - 1;
  return values.slice(1).map((v, i) => order * (v - values[i]));
}

/** bezier-js's droots: the roots of a derivative given by its 2 or 3 Bernstein coefficients. */
function getDerivativeRoots(p: readonly number[]): number[] {
  if (p.length === 3) {
    const [a, b, c] = p;
    const d = a - 2 * b + c;
    if (d !== 0) {
      const m1 = -Math.sqrt(b * b - a * c);
      const m2 = -a + b;
      return [-(m1 + m2) / d, -(-m1 + m2) / d];
    }
    return b !== c ? [(2 * b - c) / (2 * (b - c))] : [];
  }
  const [a, b] = p;
  return a !== b ? [a / (a - b)] : [];
}

/** bezier-js's compute, for one dimension of a quadratic or cubic curve. */
function evaluateCurve(p: readonly number[], t: number) {
  if (t === 0) {
    return p[0];
  }
  if (t === 1) {
    return p[p.length - 1];
  }
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  if (p.length === 3) {
    return mt2 * p[0] + mt * t * 2 * p[1] + t2 * p[2];
  }
  return mt2 * mt * p[0] + mt2 * t * 3 * p[1] + mt * t2 * 3 * p[2] + t * t2 * p[3];
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
