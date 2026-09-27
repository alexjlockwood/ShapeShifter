import {
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  TRANSFORM_DEFAULTS,
  TRANSFORM_PROPERTY_NAMES,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import type { Animation } from 'app/modules/editor/model/timeline';
import { uniqueId } from 'lodash-es';

/**
 * Replaces each path that uses its transform (LayerUtil.pathUsesTransform) with a group that has
 * the path's transform, around the path without one, since VectorDrawable and SVG paths can't be
 * transformed. The group has a new id and a unique name, `${name}_transform`, and it takes the
 * path's transform blocks, so an AnimatedVectorDrawable targets it by that name. It takes the
 * path's place, so a clip path before it still clips it. The layers and the animation are
 * returned as they are if no path uses its transform. The exports call it first.
 */
export function wrapPathTransforms(vl: VectorLayer): VectorLayer;
export function wrapPathTransforms(
  vl: VectorLayer,
  animation: Animation,
): { vectorLayer: VectorLayer; animation: Animation };
export function wrapPathTransforms(vl: VectorLayer, animation?: Animation) {
  const usedNames = new Set(LayerUtil.runPreorderTraversal(vl).map(l => l.name));
  // The ids of the wrapped paths, and of the groups around them.
  const groupIds = new Map<string, string>();
  const wrap = (path: PathLayer) => {
    const inner = path.clone();
    Object.assign(inner, TRANSFORM_DEFAULTS);
    const name = LayerUtil.getUniqueName(`${path.name}_transform`, n => usedNames.has(n));
    usedNames.add(name);
    const group = new GroupLayer({
      id: uniqueId(),
      name,
      children: [inner],
      rotation: path.rotation,
      scaleX: path.scaleX,
      scaleY: path.scaleY,
      pivotX: path.pivotX,
      pivotY: path.pivotY,
      translateX: path.translateX,
      translateY: path.translateY,
    });
    groupIds.set(path.id, group.id);
    return group;
  };
  const vectorLayer = (function recurseFn(layer: Layer): Layer {
    if (LayerUtil.pathUsesTransform(layer, animation)) {
      return wrap(layer as PathLayer);
    }
    const children = layer.children.map(recurseFn);
    if (children.every((child, i) => child === layer.children[i])) {
      return layer;
    }
    const clone = layer.clone();
    clone.children = children;
    return clone;
  })(vl) as VectorLayer;
  if (!animation) {
    return vectorLayer;
  }
  if (!groupIds.size) {
    return { vectorLayer, animation };
  }
  const transformNames: ReadonlySet<string> = new Set(TRANSFORM_PROPERTY_NAMES);
  const wrapped = animation.clone();
  wrapped.blocks = animation.blocks.map(block => {
    const groupId = groupIds.get(block.layerId);
    if (!groupId || !transformNames.has(block.propertyName)) {
      return block;
    }
    const clone = block.clone();
    clone.layerId = groupId;
    return clone;
  });
  return { vectorLayer, animation: wrapped };
}
