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
import { Matrix } from 'app/modules/editor/scripts/common';
import { uniqueId } from 'lodash-es';

/**
 * Returns the layers that aren't inside of another one of the layers, and so move with it, in the
 * order they're drawn. The vector layer itself can't move.
 */
export function getTopmostLayerIds(vl: VectorLayer, layerIds: Iterable<string>) {
  const ids = new Set(layerIds);
  const topmost: string[] = [];
  (function recurseFn(layer: Layer) {
    if (ids.has(layer.id) && layer !== vl) {
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
  let { vectorLayer, animation } = document;
  for (const layerId of getTopmostLayerIds(vectorLayer, layerIds)) {
    const layer = vectorLayer.findLayerById(layerId);
    const inverse = LayerUtil.getCanvasTransformForLayer(rendered, layerId).invert();
    if (!layer || !inverse) {
      // A group scaled to 0 can't be moved from within.
      continue;
    }
    // Only the linear part, since this is a distance.
    const x = inverse.a * dx + inverse.c * dy;
    const y = inverse.b * dx + inverse.d * dy;
    if (layer instanceof PathLayer || layer instanceof ClipPathLayer) {
      const move = (path: Path) => path.transform(Matrix.translation(x, y));
      const clone = layer.clone();
      if (clone.pathData) {
        clone.pathData = move(clone.pathData);
      }
      vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, clone);
      animation = mapBlocks(animation, layerId, 'pathData', move);
    } else if (layer instanceof GroupLayer) {
      const clone = layer.clone();
      clone.translateX += x;
      clone.translateY += y;
      vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, clone);
      animation = mapBlocks(animation, layerId, 'translateX', (value: number) => value + x);
      animation = mapBlocks(animation, layerId, 'translateY', (value: number) => value + y);
    }
  }
  return { vectorLayer, animation };
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
 * Copies the layers, each just above the original, with new ids and names and their animation
 * blocks, since the AnimatedVectorDrawable export targets layers by name. Returns the new
 * document and the ids of the copies.
 */
export function duplicateLayers(document: CanvasDocument, layerIds: Iterable<string>) {
  let { vectorLayer } = document;
  const newIdsByOldId = new Map<string, string>();
  const copyIds: string[] = [];
  const usedNames = new Set(LayerUtil.runPreorderTraversal(vectorLayer).map(l => l.name));
  for (const layerId of getTopmostLayerIds(vectorLayer, layerIds)) {
    const layer = vectorLayer.findLayerById(layerId);
    const parent = LayerUtil.findParent(vectorLayer, layerId);
    if (!layer || !parent) {
      continue;
    }
    const copy = (function recurseFn(current: Layer): Layer {
      const clone = current.clone();
      clone.id = uniqueId();
      newIdsByOldId.set(current.id, clone.id);
      // A copy of a copy is numbered like the first copy: a_2 rather than a_1_1. The copies'
      // names count too, e.g. for a group and a child with the same name.
      const base = /^(.*)_\d+$/.exec(current.name)?.[1];
      const prefix = base !== undefined && usedNames.has(base) ? base : current.name;
      clone.name = LayerUtil.getUniqueName(prefix, name => usedNames.has(name) || undefined);
      usedNames.add(clone.name);
      clone.children = current.children.map(recurseFn);
      return clone;
    })(layer);
    const parentClone = parent.clone();
    const index = parent.children.findIndex(child => child.id === layerId);
    parentClone.children = [
      ...parent.children.slice(0, index + 1),
      copy,
      ...parent.children.slice(index + 1),
    ];
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, parent.id, parentClone);
    copyIds.push(copy.id);
  }
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
  return { document: { vectorLayer, animation }, layerIds: copyIds };
}
