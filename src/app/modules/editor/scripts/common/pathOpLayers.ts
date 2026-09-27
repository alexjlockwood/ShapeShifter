import { getTopmostLayerIds } from 'app/modules/editor/components/canvas/transformLayers';
import { GroupLayer, LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import type { Animation } from 'app/modules/editor/model/timeline';

// Which layers the operations that turn several paths into one (Combine, and the canvas editor's
// boolean operations) and outlining strokes apply to. They're outside of the canvas editor, so
// that the context menu can say why one doesn't apply, even with the editor off.

/** The layers and the animation, as the store and the canvas editor's preview hold them. */
export interface LayerDocument {
  readonly vectorLayer: VectorLayer;
  readonly animation: Animation;
}

/** The layers an operation applies to, or why it can't run. */
export type LayerIdsOrReason =
  | { readonly layerIds: ReadonlyArray<string>; readonly reason?: undefined }
  | { readonly layerIds?: undefined; readonly reason: string };

/**
 * Returns the paths that merging the selection into one path merges, bottom first, or why it
 * can't. The result replaces them with the bottom one, which keeps its style and its animations,
 * in its own coordinates. So every layer has to be a path (not a clip path or a group) with a
 * path, none of their paths can be animated, the others can't have animations that would be lost,
 * and the groups they're in can't be animated unless the bottom one is in them too. Returns
 * undefined if fewer than two layers are selected, when there's nothing to merge.
 */
export function getMergedLayerIds(
  document: LayerDocument,
  selectedLayerIds: Iterable<string>,
): LayerIdsOrReason | undefined {
  const { vectorLayer, animation } = document;
  const layerIds = getTopmostLayerIds(vectorLayer, selectedLayerIds);
  if (layerIds.length < 2) {
    return undefined;
  }
  const paths = layerIds
    .map(id => vectorLayer.findLayerById(id))
    .filter(layer => layer instanceof PathLayer);
  if (paths.length !== layerIds.length) {
    return { reason: 'Only paths can be combined' };
  }
  const empty = paths.find(path => !path.pathData?.getPathString());
  if (empty) {
    return { reason: `${empty.name} has no path` };
  }
  const morphing = paths.find(path => isPathAnimated(animation, path.id));
  if (morphing) {
    return { reason: `${morphing.name}'s path is animated` };
  }
  const [bottomId, ...otherIds] = layerIds;
  const animated = paths.slice(1).find(path => hasBlocks(animation, path.id));
  if (animated) {
    return { reason: `${animated.name}'s animations would be lost` };
  }
  // The merged path takes the bottom one's place, so the others move with the bottom one's groups
  // instead of their own. That's only a problem for animated groups that some of them are in and
  // others aren't: those paths would stop moving with the group, or start to.
  const bottomAncestors = getAncestorIds(vectorLayer, bottomId);
  for (const id of otherIds) {
    const ancestors = getAncestorIds(vectorLayer, id);
    const group = [
      ...ancestors.filter(ancestorId => !bottomAncestors.includes(ancestorId)),
      ...bottomAncestors.filter(ancestorId => !ancestors.includes(ancestorId)),
    ]
      .map(ancestorId => vectorLayer.findLayerById(ancestorId))
      .find(layer => layer instanceof GroupLayer && hasBlocks(animation, layer.id));
    if (group) {
      return { reason: `${group.name}'s transform is animated` };
    }
  }
  return { layerIds };
}

/**
 * Returns the paths a boolean operation combines, bottom first, or undefined if it can't (see
 * getMergedLayerIds).
 */
export function getBooleanLayerIds(document: LayerDocument, selectedLayerIds: Iterable<string>) {
  return getMergedLayerIds(document, selectedLayerIds)?.layerIds;
}

/** Returns the selected paths (not the groups they're in) that have a stroke to outline. */
export function getStrokedPathIds(document: LayerDocument, selectedLayerIds: Iterable<string>) {
  return getTopmostLayerIds(document.vectorLayer, selectedLayerIds).filter(id => {
    const layer = document.vectorLayer.findLayerById(id);
    return (
      layer instanceof PathLayer &&
      !!layer.pathData?.getPathString() &&
      !!layer.strokeColor &&
      layer.strokeWidth > 0
    );
  });
}

/** Returns the stroked paths that outlining their strokes changes, if there are any. */
export function getOutlineLayerIds(document: LayerDocument, selectedLayerIds: Iterable<string>) {
  const layerIds = getStrokedPathIds(document, selectedLayerIds).filter(
    // Its stroke's width and trim, as well as its path, would stop animating.
    id => !hasBlocks(document.animation, id),
  );
  return layerIds.length ? layerIds : undefined;
}

export function isPathAnimated(animation: Animation, layerId: string) {
  return animation.blocks.some(
    block => block.layerId === layerId && block.propertyName === 'pathData',
  );
}

export function hasBlocks(animation: Animation, layerId: string) {
  return animation.blocks.some(block => block.layerId === layerId);
}

/** Returns the ids of the groups the layer is in, innermost first, without the vector layer. */
export function getAncestorIds(vl: VectorLayer, layerId: string) {
  const ids: string[] = [];
  for (let parent = LayerUtil.findParent(vl, layerId); parent && parent.id !== vl.id;) {
    ids.push(parent.id);
    parent = LayerUtil.findParent(vl, parent.id);
  }
  return ids;
}
