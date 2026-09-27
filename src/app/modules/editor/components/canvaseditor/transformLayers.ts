import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { Matrix, Point } from 'app/modules/editor/scripts/common';
import { round, uniqueId } from 'lodash-es';

/**
 * Returns the layers that aren't inside of another one of the layers, and so move with it, in the
 * order they're drawn. The vector layer itself can't move, so selecting it moves what's in it.
 */
export function getTopmostLayerIds(vl: VectorLayer, layerIds: Iterable<string>) {
  const ids = new Set(layerIds);
  if (ids.has(vl.id)) {
    return vl.children.map(child => child.id);
  }
  const topmost: string[] = [];
  (function recurseFn(layer: Layer) {
    if (ids.has(layer.id)) {
      topmost.push(layer.id);
      return;
    }
    layer.children.forEach(recurseFn);
  })(vl);
  return topmost;
}

/**
 * Moves the layers by a distance in viewport coordinates, with their animations, so that they move
 * at every time. Paths have no position of their own, so their paths and path blocks move, and
 * groups move by their translation and its blocks. The distance is converted to each layer's
 * parent's coordinates with the parent's transform in the rendered vector layer, where it's seen.
 */
export function translateLayers(
  document: CanvasDocument,
  rendered: VectorLayer,
  layerIds: Iterable<string>,
  dx: number,
  dy: number,
): CanvasDocument {
  if (!dx && !dy) {
    return document;
  }
  let { animation } = document;
  const moves = new Map<string, Point>();
  for (const layerId of getTopmostLayerIds(document.vectorLayer, layerIds)) {
    const inverse = LayerUtil.getCanvasTransformForLayer(rendered, layerId).invert();
    if (!inverse) {
      // A group scaled to 0 can't be moved from within.
      continue;
    }
    // Only the linear part, since this is a distance.
    moves.set(layerId, {
      x: inverse.a * dx + inverse.c * dy,
      y: inverse.b * dx + inverse.d * dy,
    });
  }
  const vectorLayer = mapLayers(document.vectorLayer, layer => {
    const move = moves.get(layer.id);
    if (!move) {
      return layer;
    }
    const { x, y } = move;
    if (layer instanceof PathLayer || layer instanceof ClipPathLayer) {
      const translate = (path: Path) => path.mutate().transform(Matrix.translation(x, y)).build();
      animation = mapBlocks(animation, layer.id, 'pathData', translate);
      const clone = layer.clone();
      if (clone.pathData) {
        clone.pathData = translate(clone.pathData);
      }
      return clone;
    }
    if (layer instanceof GroupLayer) {
      // Rounded like the inspector shows them, so that moves don't leave long decimals behind.
      const translateX = (value: number) => round(value + x, 3);
      const translateY = (value: number) => round(value + y, 3);
      animation = mapBlocks(animation, layer.id, 'translateX', translateX);
      animation = mapBlocks(animation, layer.id, 'translateY', translateY);
      const clone = layer.clone();
      clone.translateX = translateX(clone.translateX);
      clone.translateY = translateY(clone.translateY);
      return clone;
    }
    return layer;
  });
  return { vectorLayer, animation };
}

/**
 * Rebuilds the tree in one pass, cloning only the layers that change and the ones above them. fn
 * gets each layer after its children, and returns it or its replacement.
 */
function mapLayers(vl: VectorLayer, fn: (layer: Layer) => Layer) {
  return (function recurseFn(layer: Layer): Layer {
    const children = layer.children.map(recurseFn);
    let result = layer;
    if (children.some((child, i) => child !== layer.children[i])) {
      result = layer.clone();
      result.children = children;
    }
    return fn(result);
  })(vl) as VectorLayer;
}

/** Returns the animation with the layer's blocks of the property changed by fn. */
function mapBlocks<T extends number | Path>(
  animation: Animation,
  layerId: string,
  propertyName: string,
  fn: (value: T) => T,
) {
  if (!animation.blocks.some(b => b.layerId === layerId && b.propertyName === propertyName)) {
    return animation;
  }
  const clone = animation.clone();
  clone.blocks = animation.blocks.map(block => {
    if (block.layerId !== layerId || block.propertyName !== propertyName) {
      return block;
    }
    const blockClone = block.clone();
    if (blockClone.fromValue !== undefined) {
      blockClone.fromValue = fn(blockClone.fromValue as T);
    }
    if (blockClone.toValue !== undefined) {
      blockClone.toValue = fn(blockClone.toValue as T);
    }
    return blockClone;
  });
  return clone;
}

/**
 * Copies the layers, with new ids and names and their animation blocks, since the
 * AnimatedVectorDrawable export targets layers by name. The copies of a group's layers go just
 * above the topmost one, in the same order, and copies of hidden layers are hidden too. Returns the
 * new document, the ids of the copies, and the hidden layers with the copies in them.
 */
export function duplicateLayers(
  document: CanvasDocument,
  layerIds: Iterable<string>,
  hiddenLayerIds: ReadonlySet<string> = new Set(),
) {
  const { vectorLayer } = document;
  const newIdsByOldId = new Map<string, string>();
  const copiesByParentId = new Map<string, Layer[]>();
  const hiddenCopyIds: string[] = [];
  const usedNames = new Set(LayerUtil.runPreorderTraversal(vectorLayer).map(l => l.name));
  const copy = (layer: Layer): Layer => {
    const clone = layer.clone();
    clone.id = uniqueId();
    newIdsByOldId.set(layer.id, clone.id);
    if (hiddenLayerIds.has(layer.id)) {
      hiddenCopyIds.push(clone.id);
    }
    // A copy of a copy is numbered like the first copy: a_2 rather than a_1_1. The copies' names
    // count too, e.g. for a group and a child with the same name.
    const base = /^(.*)_\d+$/.exec(layer.name)?.[1];
    const prefix = base !== undefined && usedNames.has(base) ? base : layer.name;
    clone.name = LayerUtil.getUniqueName(prefix, name => usedNames.has(name) || undefined);
    usedNames.add(clone.name);
    clone.children = layer.children.map(copy);
    return clone;
  };
  const copyIds: string[] = [];
  for (const layerId of getTopmostLayerIds(vectorLayer, layerIds)) {
    const layer = vectorLayer.findLayerById(layerId);
    const parent = LayerUtil.findParent(vectorLayer, layerId);
    if (!layer || !parent) {
      continue;
    }
    const copied = copy(layer);
    copyIds.push(copied.id);
    copiesByParentId.set(parent.id, [...(copiesByParentId.get(parent.id) ?? []), copied]);
  }
  const copiedIds = new Set(newIdsByOldId.keys());
  const newVectorLayer = mapLayers(vectorLayer, layer => {
    const copies = copiesByParentId.get(layer.id);
    if (!copies) {
      return layer;
    }
    const clone = layer.clone();
    const index = layer.children.findLastIndex(child => copiedIds.has(child.id));
    clone.children = [
      ...layer.children.slice(0, index + 1),
      ...copies,
      ...layer.children.slice(index + 1),
    ];
    return clone;
  });
  let { animation } = document;
  const copiedBlocks: AnimationBlock[] = animation.blocks
    .filter(block => newIdsByOldId.has(block.layerId))
    .map(block => {
      const clone = block.clone();
      clone.id = uniqueId();
      clone.layerId = newIdsByOldId.get(block.layerId) ?? block.layerId;
      return clone;
    });
  if (copiedBlocks.length) {
    animation = animation.clone();
    animation.blocks = [...animation.blocks, ...copiedBlocks];
  }
  return {
    document: { vectorLayer: newVectorLayer, animation },
    layerIds: copyIds,
    hiddenLayerIds: hiddenCopyIds.length
      ? new Set([...hiddenLayerIds, ...hiddenCopyIds])
      : hiddenLayerIds,
  };
}

/**
 * Transforms the layers by a matrix in viewport coordinates, with their animations. Every path in
 * them is transformed in its own coordinates, along with its path blocks. Groups keep their own
 * transforms, which can't express every matrix: scaling a rotated group along one axis skews it.
 */
export function transformLayers(
  document: CanvasDocument,
  rendered: VectorLayer,
  layerIds: Iterable<string>,
  matrix: Matrix,
): CanvasDocument {
  let { vectorLayer, animation } = document;
  for (const layerId of getTopmostLayerIds(vectorLayer, layerIds)) {
    const layer = vectorLayer.findLayerById(layerId);
    if (!layer) {
      continue;
    }
    for (const current of LayerUtil.runPreorderTraversal(layer)) {
      if (!(current instanceof PathLayer || current instanceof ClipPathLayer)) {
        continue;
      }
      const toViewport = LayerUtil.getCanvasTransformForLayer(rendered, current.id);
      const fromViewport = toViewport.invert();
      if (!fromViewport) {
        continue;
      }
      // Into viewport coordinates, through the matrix, and back.
      const local = fromViewport.dot(matrix).dot(toViewport);
      const transform = (path: Path) => path.transform(local);
      const clone = current.clone();
      if (clone.pathData) {
        clone.pathData = transform(clone.pathData);
      }
      vectorLayer = LayerUtil.replaceLayer(vectorLayer, current.id, clone);
      animation = mapBlocks(animation, current.id, 'pathData', transform);
    }
  }
  return { vectorLayer, animation };
}

/** Returns a matrix that scales around a point. */
export function scalingAround({ x, y }: { x: number; y: number }, sx: number, sy: number) {
  return new Matrix(sx, 0, 0, sy, x - sx * x, y - sy * y);
}

/** Returns a matrix that rotates around a point, clockwise on the screen for positive degrees. */
export function rotationAround({ x, y }: { x: number; y: number }, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return new Matrix(cos, sin, -sin, cos, x - cos * x + sin * y, y - sin * x - cos * y);
}
