import { Path } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, type Point } from 'app/modules/editor/scripts/common';
import { environment } from 'environments/environment';
import { findIndex, flatMap, round } from 'lodash-es';
import {
  ClipPathLayer,
  getTransformMatrices,
  GroupLayer,
  isTransformed,
  Layer,
  PathLayer,
  type Transform,
  TRANSFORM_DEFAULTS,
  TRANSFORM_PROPERTY_NAMES,
  VectorLayer,
} from './Layer';

const IS_DEV_BUILD = !environment.production;

/**
 * Returns the matrix that maps the layer's coordinates to the viewport's, for drawing it: its
 * parents' transforms, and a path's own. Its inverse maps the viewport back to the layer's
 * coordinates, e.g. to edit a path's points. A group's own transform isn't included, since it
 * applies to its children, and neither is a clip path's, since clip paths have none. It's the
 * identity if the layer doesn't exist.
 */
export function getCanvasTransformForLayer(root: Layer, layerId: string) {
  const layer = root.findLayerById(layerId);
  return Matrix.flatten([
    getParentTransformForLayer(root, layerId),
    ...(layer instanceof PathLayer ? getLayerTransforms(layer) : []),
  ]);
}

/**
 * Returns the matrix that maps the coordinates of the layer's parent to the viewport's: the
 * transforms of the groups it's in, without its own. E.g. a distance on the canvas goes through its
 * inverse to move a path by its translation. It's the identity if the layer doesn't exist.
 */
export function getParentTransformForLayer(root: Layer, layerId: string) {
  return Matrix.flatten(getParentTransformsForLayer(root, layerId) ?? []);
}

/**
 * Returns a list of parent transforms for the specified layer ID. The transforms
 * are returned in top-down order (i.e. the transform for the layer's
 * immediate parent will be the very last matrix in the returned list).
 */
function getParentTransformsForLayer(root: Layer, layerId: string) {
  return (function recurseFn(parents: Layer[], current: Layer): Matrix[] | undefined {
    if (current.id === layerId) {
      return flatMap(parents, getLayerTransforms);
    }
    for (const child of current.children) {
      const transforms = recurseFn([...parents, current], child);
      if (transforms) {
        return transforms;
      }
    }
    return undefined;
  })([], root);
}

/**
 * Returns the matrices of the layer's own transform, which map its coordinates to its parent's
 * (see getTransformMatrices), for a group or a path. Other layers have no transform.
 */
export function getLayerTransforms(layer: Layer) {
  return layer instanceof GroupLayer || layer instanceof PathLayer
    ? getTransformMatrices(layer)
    : [];
}

/**
 * Returns the transform, with the given pivot (0 by default), whose matrix is the given one: a
 * scale, then a rotation, then a translation. A mirror is a negative y scale. A transform can't
 * skew, so for a matrix that does (see isSkewed), it returns the closest one, which keeps the x
 * axis.
 */
export function toTransform(m: Matrix, pivot: Point = { x: 0, y: 0 }): Transform {
  const { a, b, c, d } = m;
  let scaleX = Math.hypot(a, b);
  let scaleY: number;
  let radians: number;
  if (scaleX) {
    radians = Math.atan2(b, a);
    // The determinant is scaleX * scaleY, and it's negative for a mirror.
    scaleY = (a * d - b * c) / scaleX;
  } else {
    // The x axis collapses to nothing, so the y axis says how it's rotated.
    scaleX = 0;
    scaleY = Math.hypot(c, d);
    radians = scaleY ? Math.atan2(-c, d) : 0;
  }
  // The matrix maps a point x to pivot + translation + L(x - pivot), where L is its scale and
  // rotation, so it maps the pivot itself to pivot + translation.
  const moved = MathUtil.transformPoint(pivot, m);
  return {
    ...TRANSFORM_DEFAULTS,
    rotation: MathUtil.round((radians * 180) / Math.PI),
    scaleX: MathUtil.round(scaleX),
    scaleY: MathUtil.round(scaleY),
    pivotX: MathUtil.round(pivot.x),
    pivotY: MathUtil.round(pivot.y),
    translateX: MathUtil.round(moved.x - pivot.x),
    translateY: MathUtil.round(moved.y - pivot.y),
  };
}

/**
 * Returns whether the matrix skews, which no transform can do: its axes aren't at right angles,
 * e.g. after scaling a rotated shape along one axis.
 */
export function isSkewed({ a, b, c, d }: Matrix) {
  return Math.abs(a * c + b * d) > 1e-6 * Math.max(1, Math.hypot(a, b) * Math.hypot(c, d));
}

/** The part of an animation that says whether a layer's properties are animated. */
interface BlockList {
  readonly blocks: ReadonlyArray<{ readonly layerId: string; readonly propertyName: string }>;
}

/** Returns whether any of the layer's transform properties are animated. */
export function hasTransformBlocks(animation: BlockList, layerId: string) {
  const names: ReadonlySet<string> = new Set(TRANSFORM_PROPERTY_NAMES);
  return animation.blocks.some(b => b.layerId === layerId && names.has(b.propertyName));
}

/**
 * Returns whether the layer is a path that uses its transform: its rotation, scale, or translation
 * isn't the default, or it's animated. A pivot alone doesn't count, since it moves nothing. The
 * exports wrap such a path in a group, and paths that don't are moved by their path data.
 */
export function pathUsesTransform(layer: Layer | undefined, animation?: BlockList) {
  return (
    layer instanceof PathLayer &&
    (isTransformed(layer) || (!!animation && hasTransformBlocks(animation, layer.id)))
  );
}

/**
 * Returns a pivot at the center of the vector layer's viewport, for a new layer added to the
 * parent, so that it rotates and scales around the middle of the canvas. It's in the coordinates
 * of the parent's children, so a transformed parent still puts it at the canvas's center. Pivots
 * are absolute, so it stays where it is if the layer or the viewport changes later.
 */
export function getCenterPivot(vl: VectorLayer, parentId: string) {
  const parent = vl.findLayerById(parentId);
  const transform = Matrix.flatten([
    getParentTransformForLayer(vl, parentId),
    ...(parent ? getLayerTransforms(parent) : []),
  ]);
  const center = { x: vl.width / 2, y: vl.height / 2 };
  // A parent scaled to 0 can't be inverted, and hides the layer anyway.
  const inverse = transform.invert();
  const { x, y } = inverse ? MathUtil.transformPoint(center, inverse) : center;
  return { pivotX: round(x, 3), pivotY: round(y, 3) };
}

/**
 * Returns a pivot at the center of the path's bounds, so that the path rotates and scales in
 * place, or undefined if the path draws nothing. Imported paths and Break apart's pieces use it.
 */
export function getPathCenterPivot(pathData: Path | undefined) {
  const bounds = pathData?.getBoundingBox();
  if (!bounds || ![bounds.l, bounds.t, bounds.r, bounds.b].every(Number.isFinite)) {
    return undefined;
  }
  return {
    pivotX: round((bounds.l + bounds.r) / 2, 3),
    pivotY: round((bounds.t + bounds.b) / 2, 3),
  };
}

/**
 * Makes two vector layers with possibly different viewports compatible with each other.
 */
export function adjustViewports(vl1: VectorLayer, vl2: VectorLayer) {
  if (!vl1 || !vl2) {
    return { vl1, vl2 };
  }

  vl1 = vl1.deepClone();
  vl2 = vl2.deepClone();

  let { width: w1, height: h1 } = vl1;
  let { width: w2, height: h2 } = vl2;
  const isMaxDimenFn = (n: number) => Math.max(w1, h1, w2, h2, n) === n;

  let scale1 = 1;
  let scale2 = 1;
  if (isMaxDimenFn(w1)) {
    scale2 = w1 / w2;
  } else if (isMaxDimenFn(h1)) {
    scale2 = h1 / h2;
  } else if (isMaxDimenFn(w2)) {
    scale1 = w2 / w1;
  } else {
    scale1 = h2 / h1;
  }

  if (isMaxDimenFn(w1) || isMaxDimenFn(h1)) {
    w1 = MathUtil.round(w1);
    h1 = MathUtil.round(h1);
    w2 = MathUtil.round(w2 * scale2);
    h2 = MathUtil.round(h2 * scale2);
  } else {
    w1 = MathUtil.round(w1 * scale1);
    h1 = MathUtil.round(h1 * scale1);
    w2 = MathUtil.round(w2);
    h2 = MathUtil.round(h2);
  }

  let tx1 = 0;
  let ty1 = 0;
  let tx2 = 0;
  let ty2 = 0;
  if (w1 > w2) {
    tx2 = (w1 - w2) / 2;
  } else if (w1 < w2) {
    tx1 = (w2 - w1) / 2;
  } else if (h1 > h2) {
    ty2 = (h1 - h2) / 2;
  } else if (h1 < h2) {
    ty1 = (h2 - h1) / 2;
  }

  const transformLayerFn = (vl: VectorLayer, scale: number, tx: number, ty: number) => {
    // Scales the layers, and then centers them, since the offset is in the new viewport's units.
    const transforms = Matrix.flatten([Matrix.translation(tx, ty), Matrix.scaling(scale, scale)]);
    // Every layer's coordinates are scaled and offset the same way, so each transform gets the
    // same matrix on both sides: its pivot moves with the layers, and its translation only
    // scales, since it's a distance. That keeps rotations and scales around the same place.
    const transformFn = (l: GroupLayer | PathLayer) => {
      const pivot = MathUtil.transformPoint({ x: l.pivotX, y: l.pivotY }, transforms);
      l.pivotX = pivot.x;
      l.pivotY = pivot.y;
      l.translateX *= scale;
      l.translateY *= scale;
    };
    (function recurseFn(layer: Layer) {
      if (layer instanceof PathLayer || layer instanceof ClipPathLayer) {
        if (layer instanceof PathLayer) {
          if (layer.isStroked()) {
            layer.strokeWidth *= scale;
          }
          transformFn(layer);
        }
        if (layer.pathData) {
          layer.pathData = new Path(
            layer.pathData.getCommands().map(cmd => cmd.mutate().transform(transforms).build()),
          );
        }
        return;
      }
      if (layer instanceof GroupLayer) {
        transformFn(layer);
      }
      layer.children.forEach(l => recurseFn(l));
    })(vl);
  };

  transformLayerFn(vl1, scale1, tx1, ty1);
  transformLayerFn(vl2, scale2, tx2, ty2);

  const newWidth = Math.max(w1, w2);
  const newHeight = Math.max(h1, h2);
  vl1.width = newWidth;
  vl2.width = newWidth;
  vl1.height = newHeight;
  vl2.height = newHeight;
  return { vl1, vl2 };
}

export function mergeVectorLayers(vl1: VectorLayer, vl2: VectorLayer) {
  const { vl1: newVl1, vl2: newVl2 } = adjustViewports(vl1, vl2);
  const vl = setLayerChildren(newVl1, [...newVl1.children, ...newVl2.children]);
  if (!newVl1.children.length) {
    // Only replace the vector layer's alpha if there are no children
    // being displayed to the user. This is pretty much the best
    // we can do.
    vl.alpha = newVl2.alpha;
  }
  return vl;
}

/**
 * Adds a list of children to a parent layer in a vector layer tree.
 * @param root the root vector layer
 * @param addedLayerParentId the parent layer in which to add the given layers
 * @param startingChildIndex the index to start adding the layers
 * @param addedLayers the layers to add
 */
export function addLayers(
  root: VectorLayer,
  addedLayerParentId: string,
  startingChildIndex: number,
  ...addedLayers: Layer[]
) {
  return (function recurseFn(curr: Layer) {
    if (curr.id === addedLayerParentId) {
      // If we have reached the added layer's parent, then
      // clone the parent, insert the new layer into its list
      // of children, and return the new parent node.
      const children = [...curr.children];
      children.splice(startingChildIndex, 0, ...addedLayers);
      return setLayerChildren(curr, children);
    }
    for (let i = 0; i < curr.children.length; i++) {
      const clonedChild = recurseFn(curr.children[i]);
      if (clonedChild) {
        // Then clone the current layer, insert the cloned child
        // into its list of children, and return the cloned current layer.
        const children = [...curr.children];
        children[i] = clonedChild;
        return setLayerChildren(curr, children);
      }
    }
    return undefined;
  })(root) as VectorLayer;
}

/** Returns a copy of the layer with the specified descendants removed. */
export function removeLayers<L extends Layer>(layer: L, ...removedLayerIds: string[]) {
  const layerIds = new Set(removedLayerIds);
  return (function recurseFn<T extends Layer>(curr: T): T {
    const children = curr.children.filter(l => !layerIds.has(l.id)).map(recurseFn);
    return setLayerChildren(curr, children);
  })(layer);
}

export function updateLayer(vl: VectorLayer, layer: Layer) {
  return replaceLayer(vl, layer.id, layer);
}

export function replaceLayer(vl: VectorLayer, layerId: string, replacement: Layer) {
  if (IS_DEV_BUILD && !vl.findLayerById(layerId)) {
    console.warn('Attempt to replace a layer that does not exist in the tree');
  }
  return (function recurseFn(curr: Layer): Layer {
    return curr.id === layerId
      ? replacement
      : setLayerChildren(
          curr,
          curr.children.map(child => recurseFn(child)),
        );
  })(vl) as VectorLayer;
}

export function runPreorderTraversal(layer: Layer) {
  // Add the layers as we iterate the tree to ensure they are properly sorted.
  const layers: Layer[] = [];
  (function recurseFn(l: Layer) {
    layers.push(l);
    l.children.forEach(recurseFn);
  })(layer);
  return layers;
}

export function findLayerByName(layers: ReadonlyArray<Layer>, layerName: string) {
  for (const layer of layers) {
    const target = layer.findLayerByName(layerName);
    if (target) {
      return target;
    }
  }
  return undefined;
}

export function findParent(vl: VectorLayer, layerId: string) {
  return (function recurseFn(curr: Layer, parent?: Layer): Layer | undefined {
    if (curr.id === layerId) {
      return parent;
    }
    for (const child of curr.children) {
      const p = recurseFn(child, curr);
      if (p) {
        return p;
      }
    }
    return undefined;
  })(vl);
}

export function findNextSibling(vl: VectorLayer, layerId: string) {
  return findSibling(layerId, findParent(vl, layerId), 1);
}

export function findPreviousSibling(vl: VectorLayer, layerId: string) {
  return findSibling(layerId, findParent(vl, layerId), -1);
}

function findSibling(layerId: string, parent: Layer | undefined, offset: number) {
  if (!parent || !parent.children) {
    return undefined;
  }
  let index = findIndex(parent.children, c => c.id === layerId);
  if (index < 0) {
    return undefined;
  }
  index += offset;
  if (index < 0 || parent.children.length <= index) {
    return undefined;
  }
  return parent.children[index];
}

export function getUniqueLayerName(layers: ReadonlyArray<Layer>, prefix: string) {
  return getUniqueName(prefix, name => findLayerByName(layers, name));
}

export function getUniqueName(prefix = '', objectByNameFn = (s: string) => undefined as any) {
  let n = 0;
  const nameFn = () => prefix + (n ? `_${n}` : '');
  while (true) {
    const o = objectByNameFn(nameFn());
    if (!o) {
      break;
    }
    n++;
  }
  return nameFn();
}

/**
 * Returns a cloned layer with the specified list of children layers.
 */
function setLayerChildren<L extends Layer>(layer: L, children: ReadonlyArray<Layer>) {
  const clone = layer.clone();
  clone.children = children;
  return clone as L;
}

export function toStrokeDashArray(
  trimPathStart: number,
  trimPathEnd: number,
  trimPathOffset: number,
  pathLength: number,
  // TODO: remove this eventually... it is used to fix a canvas bug (that I am probably not handling correctly)
  marginOfError = 0,
) {
  // Calculate the visible fraction of the trimmed path. If trimPathStart
  // is greater than trimPathEnd, then the result should be the combined
  // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
  let shownFraction = trimPathEnd - trimPathStart;
  if (trimPathStart > trimPathEnd) {
    shownFraction += 1;
  }
  // Calculate the dash array. The first array element is the length of
  // the trimmed path and the second element is the gap, which is the
  // difference in length between the total path length and the visible
  // trimmed path length.
  return [shownFraction * pathLength, (1 - shownFraction + marginOfError) * pathLength];
}

export function toStrokeDashOffset(
  trimPathStart: number,
  trimPathEnd: number,
  trimPathOffset: number,
  pathLength: number,
) {
  // The amount to offset the path is equal to the trimPathStart plus
  // trimPathOffset. We mod the result because the trimmed path
  // should wrap around once it reaches 1.
  return pathLength * (1 - ((trimPathStart + trimPathOffset) % 1));
}
