import { getTopmostLayerIds } from 'app/modules/editor/components/canvas/transformLayers';
import { LayerUtil, PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { commandsToString } from 'app/modules/editor/model/paths/PathParser';
import { uniqueId } from 'lodash-es';

import { Matrix } from './Matrix';
import {
  getMergedLayerIds,
  isPathAnimated,
  type LayerDocument,
  type LayerIdsOrReason,
} from './pathOpLayers';

// Combine and Break apart keep every subpath as it is, unlike the canvas editor's boolean
// operations, which rewrite the outlines (components/canvaseditor/pathOps.ts). That keeps the
// points where they were, which is better for morphing. They don't need the canvas editor.

/**
 * Returns the paths that Combine merges into the bottom one, bottom first, or why it can't (see
 * getMergedLayerIds). Trimmed paths can't be combined either, since the trim is measured along the
 * first subpath, and the canvas draws its dashes along the others too. Returns undefined if fewer
 * than two layers are selected.
 */
export function getCombinedLayerIds(
  document: LayerDocument,
  selectedLayerIds: Iterable<string>,
): LayerIdsOrReason | undefined {
  const merged = getMergedLayerIds(document, selectedLayerIds);
  if (!merged?.layerIds) {
    return merged;
  }
  const trimmed = merged.layerIds
    .map(id => document.vectorLayer.findLayerById(id))
    .find(layer => layer instanceof PathLayer && isTrimmed(document, layer));
  return trimmed ? { reason: `${trimmed.name} is trimmed` } : merged;
}

/**
 * Combines the selected paths into the bottom one, as one path with a subpath for each of theirs,
 * and removes the others. Each path is mapped into the bottom one's coordinates, so that it stays
 * where it's drawn. The combined path keeps the bottom one's style, name, id, and animations, and
 * gets an even-odd fill, so that a shape inside of another one is a hole in it (e.g. two ellipses
 * make a donut). Returns the new document and the combined path's id, or why it can't.
 */
export function combineLayers(
  document: LayerDocument,
  selectedLayerIds: Iterable<string>,
): { readonly document: LayerDocument; readonly layerId: string } | { readonly reason: string } {
  const combined = getCombinedLayerIds(document, selectedLayerIds);
  if (!combined) {
    return { reason: 'Select two or more paths to combine' };
  }
  if (!combined.layerIds) {
    return combined;
  }
  const { vectorLayer } = document;
  const [bottomId, ...otherIds] = combined.layerIds;
  const bottom = vectorLayer.findLayerById(bottomId);
  const toBottom = LayerUtil.getCanvasTransformForLayer(vectorLayer, bottomId).invert();
  if (!(bottom instanceof PathLayer) || !bottom.pathData) {
    return { reason: 'Only paths can be combined' };
  }
  if (!toBottom) {
    return { reason: `${bottom.name}'s group is scaled to nothing` };
  }
  const pathStrings = [bottom.pathData.getPathString()];
  for (const id of otherIds) {
    const layer = vectorLayer.findLayerById(id);
    if (!(layer instanceof PathLayer) || !layer.pathData) {
      continue;
    }
    const transform = toBottom.dot(LayerUtil.getCanvasTransformForLayer(vectorLayer, id));
    const path = transform.equals(Matrix.identity())
      ? layer.pathData
      : layer.pathData.mutate().transform(transform).build();
    pathStrings.push(path.getPathString());
  }
  const result = bottom.clone();
  result.pathData = new Path(pathStrings.join(' '));
  result.fillType = 'evenOdd';
  let edited = LayerUtil.replaceLayer(vectorLayer, bottomId, result);
  edited = LayerUtil.removeLayers(edited, ...otherIds);
  // The other paths have no animations, so the animation stays as it is.
  return { document: { vectorLayer: edited, animation: document.animation }, layerId: bottomId };
}

/**
 * Returns the selected paths that Break apart splits up, or why it can't. Returns undefined if
 * none of them has more than one subpath. A path whose path is animated can't be split up, since
 * its blocks would each have to be split the same way, and neither can a trimmed one, since each
 * piece would be trimmed along its own length.
 */
export function getBrokenApartLayerIds(
  document: LayerDocument,
  selectedLayerIds: Iterable<string>,
): LayerIdsOrReason | undefined {
  const { vectorLayer, animation } = document;
  const paths = getTopmostLayerIds(vectorLayer, selectedLayerIds)
    .map(id => vectorLayer.findLayerById(id))
    .filter(layer => layer instanceof PathLayer)
    .filter(layer => getPieces(layer).length > 1);
  if (!paths.length) {
    return undefined;
  }
  const morphing = paths.find(path => isPathAnimated(animation, path.id));
  if (morphing) {
    return { reason: `${morphing.name}'s path is animated` };
  }
  const trimmed = paths.find(path => isTrimmed(document, path));
  if (trimmed) {
    return { reason: `${trimmed.name} is trimmed` };
  }
  return { layerIds: paths.map(path => path.id) };
}

/**
 * Splits each of the selected paths that has several subpaths into a path for each one, in their
 * order, so the first is drawn at the bottom. The first piece keeps the path's id, name, and
 * animations. The others go right above it, with new ids, unique names, and copies of its
 * animation blocks, and they're hidden if it is. Returns the new document, the pieces' ids, and the
 * hidden layer ids, or why it can't.
 */
export function breakApartLayers(
  document: LayerDocument,
  selectedLayerIds: Iterable<string>,
  hiddenLayerIds: ReadonlySet<string> = new Set(),
):
  | {
      readonly document: LayerDocument;
      readonly layerIds: ReadonlyArray<string>;
      readonly hiddenLayerIds: ReadonlySet<string>;
    }
  | { readonly reason: string } {
  const brokenApart = getBrokenApartLayerIds(document, selectedLayerIds);
  if (!brokenApart) {
    return { reason: 'Select a path with more than one subpath' };
  }
  if (!brokenApart.layerIds) {
    return brokenApart;
  }
  let { vectorLayer } = document;
  const animation = document.animation.clone();
  const hidden = new Set(hiddenLayerIds);
  const usedNames = new Set(LayerUtil.runPreorderTraversal(vectorLayer).map(l => l.name));
  const pieceIds: string[] = [];
  for (const layerId of brokenApart.layerIds) {
    const layer = vectorLayer.findLayerById(layerId);
    const parent = LayerUtil.findParent(vectorLayer, layerId);
    if (!(layer instanceof PathLayer) || !parent) {
      continue;
    }
    const blocks = animation.blocks.filter(block => block.layerId === layerId);
    const [first, ...others] = getPieces(layer).map((pathString, i) => {
      const piece = layer.clone();
      piece.pathData = new Path(pathString);
      if (i > 0) {
        piece.id = uniqueId();
        piece.name = LayerUtil.getUniqueName(layer.name, name => usedNames.has(name));
        usedNames.add(piece.name);
      }
      return piece;
    });
    for (const piece of others) {
      animation.blocks = [
        ...animation.blocks,
        ...blocks.map(block => {
          const copy = block.clone();
          copy.id = uniqueId();
          copy.layerId = piece.id;
          return copy;
        }),
      ];
      if (hidden.has(layerId)) {
        hidden.add(piece.id);
      }
    }
    const index = parent.children.findIndex(child => child.id === layerId);
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, first);
    vectorLayer = LayerUtil.addLayers(vectorLayer, parent.id, index + 1, ...others);
    pieceIds.push(first.id, ...others.map(piece => piece.id));
  }
  return {
    document: {
      vectorLayer,
      animation:
        animation.blocks.length === document.animation.blocks.length
          ? document.animation
          : animation,
    },
    layerIds: pieceIds,
    hiddenLayerIds: hidden.size === hiddenLayerIds.size ? hiddenLayerIds : hidden,
  };
}

/**
 * Returns the path strings of the path's subpaths that draw something. The ones that collapse to a
 * point, which action mode adds for morphing, and lone moves are left out.
 */
function getPieces(layer: PathLayer) {
  return (layer.pathData?.getSubPaths() ?? [])
    .filter(subPath => !subPath.isCollapsing() && subPath.getCommands().length > 1)
    .map(subPath => commandsToString(subPath.getCommands()));
}

/** Whether the path is trimmed, or its trim is animated. */
function isTrimmed({ animation }: LayerDocument, layer: PathLayer) {
  return (
    layer.trimPathStart !== 0 ||
    layer.trimPathEnd !== 1 ||
    layer.trimPathOffset !== 0 ||
    animation.blocks.some(
      block => block.layerId === layer.id && block.propertyName.startsWith('trimPath'),
    )
  );
}
