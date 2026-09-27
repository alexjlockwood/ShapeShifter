import { autoFixPathBlocks } from 'app/modules/editor/components/canvas/pathKeyframes';
import { INTERPOLATORS } from 'app/modules/editor/model/interpolators';
import { GroupLayer, LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import type { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { uniq } from 'lodash-es';

import * as ColorUtil from './ColorUtil';
import { combineLayers } from './combineLayers';
import * as MathUtil from './MathUtil';
import { Matrix } from './Matrix';
import { getAncestorIds, hasBlocks, type LayerDocument } from './pathOpLayers';

// "Morph A into B": A gets a path block that ends in B's path, and blocks for the style that B
// has and A doesn't, and B is deleted. It's how most morphs start, so the context menu and the
// import snackbar offer it directly, rather than through the timeline and action mode. The rules
// for when it works live here, so that the menu's reasons and the morph itself never disagree.

/** How long a new morph takes, in ms. */
export const MORPH_DURATION = 300;

type StyleProperty = 'fillColor' | 'fillAlpha' | 'strokeColor' | 'strokeAlpha' | 'strokeWidth';

interface BlockValues {
  readonly propertyName: StyleProperty;
  readonly fromValue: string | number;
  readonly toValue: string | number;
}

interface MorphPlan {
  readonly startTime: number;
  readonly fromPath: Path;
  readonly toPath: Path;
  readonly styleBlocks: ReadonlyArray<BlockValues>;
}

/**
 * Returns why the layer can't be morphed into another path, whichever one that is, or undefined
 * if it can. It has to be a path (not a clip path) with a path, and its transform can't be
 * animated, since the other path is mapped into its coordinates once.
 */
export function getMorphFromRefusal(document: LayerDocument, fromId: string) {
  const from = document.vectorLayer.findLayerById(fromId);
  if (!(from instanceof PathLayer)) {
    return 'Only paths can morph';
  }
  if (!from.pathData?.getPathString()) {
    return `${from.name} has no path`;
  }
  if (LayerUtil.hasTransformBlocks(document.animation, fromId)) {
    return `${from.name}'s transform is animated`;
  }
  return undefined;
}

/**
 * Returns the paths that the layer could morph into, in the layer list's order: the other paths
 * without animations. Clip paths aren't included. Some of them may still be refused (see
 * getMorphRefusal).
 */
export function getMorphTargets(document: LayerDocument, fromId: string) {
  return LayerUtil.runPreorderTraversal(document.vectorLayer).filter(
    (layer): layer is PathLayer =>
      layer instanceof PathLayer && layer.id !== fromId && !hasBlocks(document.animation, layer.id),
  );
}

/**
 * Returns why morphIntoLayer would refuse to morph the path into the other one at the time, or
 * undefined if it wouldn't.
 */
export function getMorphRefusal(
  document: LayerDocument,
  fromId: string,
  toId: string,
  currentTime: number,
) {
  const planned = planMorph(document, fromId, toId, currentTime);
  return 'reason' in planned ? planned.reason : undefined;
}

/**
 * Morphs one path into another: it adds a block to the first path, from its path at the block's
 * start to the other path, mapped into its coordinates so that it ends up where the other one is
 * drawn. Where the fill and stroke colors, their alphas, and the stroke width differ, they get
 * blocks at the same time too. Then it deletes the other path, and auto fixes the morph. Auto fix
 * can fail on some paths, and then the morph is kept as it is, with the error, so that action mode
 * says what doesn't match. The block goes at the current time, or right after the last path
 * block, whichever has room for it. Returns the new document and the path block's id, or why it
 * can't.
 */
export function morphIntoLayer(
  document: LayerDocument,
  fromId: string,
  toId: string,
  currentTime: number,
):
  | { readonly document: LayerDocument; readonly blockId: string; readonly autoFixError?: Error }
  | { readonly reason: string } {
  const planned = planMorph(document, fromId, toId, currentTime);
  if ('reason' in planned) {
    return planned;
  }
  const { startTime, fromPath, toPath, styleBlocks } = planned;
  const endTime = startTime + MORPH_DURATION;
  const interpolator = INTERPOLATORS[0].value;
  const pathBlock = AnimationBlock.from({
    layerId: fromId,
    propertyName: 'pathData',
    type: 'path',
    startTime,
    endTime,
    fromValue: fromPath,
    toValue: toPath,
    interpolator,
  });
  const animation = document.animation.clone();
  animation.blocks = [
    ...animation.blocks,
    pathBlock,
    ...styleBlocks.map(({ propertyName, fromValue, toValue }) =>
      AnimationBlock.from({
        layerId: fromId,
        propertyName,
        type: propertyName.endsWith('Color') ? 'color' : 'number',
        startTime,
        endTime,
        fromValue,
        toValue,
        interpolator,
      }),
    ),
  ];
  const morphed = {
    vectorLayer: LayerUtil.removeLayers(document.vectorLayer, toId),
    animation,
  };
  try {
    return {
      document: autoFixPathBlocks(morphed, new Set([pathBlock.id])),
      blockId: pathBlock.id,
    };
  } catch (e) {
    const autoFixError = e instanceof Error ? e : new Error(String(e));
    return { document: morphed, blockId: pathBlock.id, autoFixError };
  }
}

/**
 * Like morphIntoLayer, for two sets of layers, e.g. the layers imported from two files. Each set's
 * paths are combined into one path first, with Combine (combineLayers), unless it's only one.
 * The groups in the sets that end up empty are removed. The sets can only hold paths and groups.
 */
export function morphLayerSets(
  document: LayerDocument,
  fromIds: ReadonlyArray<string>,
  toIds: ReadonlyArray<string>,
  currentTime: number,
): ReturnType<typeof morphIntoLayer> {
  const combined = combineLayerSets(document, fromIds, toIds);
  if ('reason' in combined) {
    return combined;
  }
  const morphed = morphIntoLayer(combined.document, combined.fromId, combined.toId, currentTime);
  if ('reason' in morphed) {
    return morphed;
  }
  const vectorLayer = removeEmptyGroups(morphed.document.vectorLayer, [...fromIds, ...toIds]);
  return { ...morphed, document: { ...morphed.document, vectorLayer } };
}

/** Returns why morphLayerSets would refuse, or undefined if it wouldn't. */
export function getMorphLayerSetsRefusal(
  document: LayerDocument,
  fromIds: ReadonlyArray<string>,
  toIds: ReadonlyArray<string>,
  currentTime: number,
) {
  const combined = combineLayerSets(document, fromIds, toIds);
  if ('reason' in combined) {
    return combined.reason;
  }
  return getMorphRefusal(combined.document, combined.fromId, combined.toId, currentTime);
}

/** What the snackbar offers after an import. */
export interface ImportMorphOffer {
  readonly message: string;
  readonly fromIds: ReadonlyArray<string>;
  readonly toIds: ReadonlyArray<string>;
}

/**
 * Returns the morph to offer after importing layers, or undefined if there's none that would
 * work. Importing one file into a document with one path offers to morph that path into what was
 * imported, and importing two files into an empty document offers to morph the first file's
 * layers into the second's.
 *
 * @param before the vector layer before the import
 * @param document the document after the import
 * @param importedIds the top-level layers each file added, as importLayers returns them
 * @param fileNames the files' names, in the same order, if they came from files
 */
export function getImportMorphOffer(
  before: VectorLayer,
  document: LayerDocument,
  importedIds: ReadonlyArray<ReadonlyArray<string>>,
  currentTime: number,
  fileNames?: ReadonlyArray<string>,
): ImportMorphOffer | undefined {
  let offer: ImportMorphOffer | undefined;
  if (importedIds.length === 1) {
    const paths = LayerUtil.runPreorderTraversal(before).filter(l => l instanceof PathLayer);
    if (paths.length !== 1 || !document.vectorLayer.findLayerById(paths[0].id)) {
      return undefined;
    }
    offer = {
      message: `Morph '${paths[0].name}' into the imported shape?`,
      fromIds: [paths[0].id],
      toIds: importedIds[0],
    };
  } else if (importedIds.length === 2 && !before.children.length) {
    const [fromIds, toIds] = importedIds;
    const [fromName, toName] = [fromIds, toIds].map(
      (ids, i) => fileNames?.[i] ?? describeLayerSet(document, ids),
    );
    offer = { message: `Morph '${fromName}' into '${toName}'?`, fromIds, toIds };
  }
  if (!offer?.fromIds.length || !offer.toIds.length) {
    return undefined;
  }
  return getMorphLayerSetsRefusal(document, offer.fromIds, offer.toIds, currentTime)
    ? undefined
    : offer;
}

/** Returns whether the block has both of its paths, which editing its morph needs. */
export function getMorphBlockRefusal(block: PathAnimationBlock) {
  return block.fromValue?.getPathString() && block.toValue?.getPathString()
    ? undefined
    : 'Set both of the paths before editing the morph';
}

function planMorph(
  document: LayerDocument,
  fromId: string,
  toId: string,
  currentTime: number,
): MorphPlan | { readonly reason: string } {
  const fromRefusal = getMorphFromRefusal(document, fromId);
  if (fromRefusal) {
    return { reason: fromRefusal };
  }
  const { vectorLayer, animation } = document;
  const from = vectorLayer.findLayerById(fromId) as PathLayer;
  const to = vectorLayer.findLayerById(toId);
  if (!(to instanceof PathLayer)) {
    return { reason: 'Only paths can morph' };
  }
  if (toId === fromId) {
    return { reason: "A path can't morph into itself" };
  }
  if (!to.pathData?.getPathString()) {
    return { reason: `${to.name} has no path` };
  }
  if (hasBlocks(animation, toId)) {
    return { reason: `${to.name} is animated` };
  }
  // The other path is mapped into the path's coordinates once, which only stays right if the
  // groups that one of them is in and the other isn't hold still.
  const fromAncestors = getAncestorIds(vectorLayer, fromId);
  const toAncestors = getAncestorIds(vectorLayer, toId);
  const animatedGroup = [
    ...fromAncestors.filter(id => !toAncestors.includes(id)),
    ...toAncestors.filter(id => !fromAncestors.includes(id)),
  ]
    .map(id => vectorLayer.findLayerById(id))
    .find(layer => layer instanceof GroupLayer && hasBlocks(animation, layer.id));
  if (animatedGroup) {
    return { reason: `${animatedGroup.name}'s transform is animated` };
  }
  const toFrom = LayerUtil.getCanvasTransformForLayer(vectorLayer, fromId).invert();
  if (!toFrom) {
    return { reason: `${from.name}'s group is scaled to nothing` };
  }
  const transform = toFrom.dot(LayerUtil.getCanvasTransformForLayer(vectorLayer, toId));
  const toPath = transform.equals(Matrix.identity())
    ? to.pathData
    : to.pathData.mutate().transform(transform).build();
  // Transforms scale strokes too.
  const toStrokeWidth = MathUtil.round(to.strokeWidth * transform.getScaleFactor());

  const pathBlocks = getBlocks(document, fromId, ['pathData']);
  const styleProperties: ReadonlyArray<StyleProperty> = [
    'fillColor',
    'fillAlpha',
    'strokeColor',
    'strokeAlpha',
    'strokeWidth',
  ];
  const lastEnd = (blocks: ReadonlyArray<AnimationBlock>) =>
    Math.max(0, ...blocks.map(b => b.endTime));
  const startTimes = uniq([
    Math.min(currentTime, animation.duration - MORPH_DURATION),
    lastEnd(pathBlocks),
    lastEnd(getBlocks(document, fromId, ['pathData', ...styleProperties])),
  ]).filter(t => t >= 0 && t + MORPH_DURATION <= animation.duration);
  const renderer = new AnimationRenderer(vectorLayer, animation);
  for (const startTime of startTimes) {
    const rendered = renderer.setCurrentTime(startTime).findLayerById(fromId);
    const fromPath = rendered instanceof PathLayer ? rendered.pathData : undefined;
    if (!(rendered instanceof PathLayer) || !fromPath?.getPathString()) {
      continue;
    }
    const styleBlocks = getStyleBlocks(rendered, to, toStrokeWidth);
    const properties = ['pathData', ...styleBlocks.map(b => b.propertyName)];
    const isFree = getBlocks(document, fromId, properties).every(
      b => b.endTime <= startTime || b.startTime >= startTime + MORPH_DURATION,
    );
    if (isFree) {
      return { startTime, fromPath, toPath, styleBlocks };
    }
  }
  return { reason: `There's no room for a ${MORPH_DURATION} ms morph in ${from.name}'s timeline` };
}

/**
 * Returns the blocks that animate the style of the path, as it is at the block's start, to the
 * other path's. A color that's only on one side fades in or out, in its alpha channel, rather than
 * popping. The alphas and stroke width of a fill or stroke that the other path doesn't have don't
 * matter.
 */
function getStyleBlocks(from: PathLayer, to: PathLayer, toStrokeWidth: number) {
  const blocks: BlockValues[] = [];
  const addColor = (propertyName: 'fillColor' | 'strokeColor') => {
    const fromColor = normalizeColor(from[propertyName]);
    const toColor = normalizeColor(to[propertyName]);
    if (fromColor === toColor) {
      return;
    }
    blocks.push({
      propertyName,
      fromValue: fromColor || transparent(toColor),
      toValue: toColor || transparent(fromColor),
    });
  };
  const addNumber = (propertyName: StyleProperty, fromValue: number, toValue: number) => {
    if (fromValue !== toValue) {
      blocks.push({ propertyName, fromValue, toValue });
    }
  };
  addColor('fillColor');
  if (normalizeColor(to.fillColor)) {
    addNumber('fillAlpha', from.fillAlpha, to.fillAlpha);
  }
  addColor('strokeColor');
  if (normalizeColor(to.strokeColor)) {
    addNumber('strokeAlpha', from.strokeAlpha, to.strokeAlpha);
    addNumber('strokeWidth', from.strokeWidth, toStrokeWidth);
  }
  return blocks;
}

/** Returns the color as an Android color string, or '' for no color. */
function normalizeColor(color: string | undefined) {
  const parsed = color ? ColorUtil.parseAndroidColor(color) : undefined;
  return parsed ? ColorUtil.toAndroidString(parsed) : '';
}

function transparent(color: string) {
  const parsed = ColorUtil.parseAndroidColor(color);
  return parsed ? ColorUtil.toAndroidString({ ...parsed, a: 0 }) : '';
}

function getBlocks(
  { animation }: LayerDocument,
  layerId: string,
  propertyNames: ReadonlyArray<string>,
) {
  return animation.blocks.filter(
    block => block.layerId === layerId && propertyNames.includes(block.propertyName),
  );
}

/**
 * Combines each set's paths into one, as the two paths to morph. Only paths and groups can be in
 * them, since morphing deletes the other side, and removes the groups it leaves empty.
 */
function combineLayerSets(
  document: LayerDocument,
  fromIds: ReadonlyArray<string>,
  toIds: ReadonlyArray<string>,
):
  | { readonly document: LayerDocument; readonly fromId: string; readonly toId: string }
  | { readonly reason: string } {
  const from = combineLayerSet(document, fromIds);
  if ('reason' in from) {
    return from;
  }
  const to = combineLayerSet(from.document, toIds);
  if ('reason' in to) {
    return to;
  }
  return { document: to.document, fromId: from.layerId, toId: to.layerId };
}

function combineLayerSet(
  document: LayerDocument,
  layerIds: ReadonlyArray<string>,
): { readonly document: LayerDocument; readonly layerId: string } | { readonly reason: string } {
  const found = layerIds.map(id => document.vectorLayer.findLayerById(id));
  if (found.some(layer => !layer)) {
    // E.g. deleted before the import snackbar's button was clicked.
    return { reason: "The layers to morph aren't there anymore" };
  }
  const layers = found
    .filter(layer => layer !== undefined)
    .flatMap(layer => LayerUtil.runPreorderTraversal(layer));
  const paths = layers.filter(layer => layer instanceof PathLayer);
  if (!paths.length || layers.some(l => !(l instanceof PathLayer || l instanceof GroupLayer))) {
    return { reason: 'Only paths can morph' };
  }
  if (paths.length === 1) {
    return { document, layerId: paths[0].id };
  }
  return combineLayers(
    document,
    paths.map(p => p.id),
  );
}

/** Removes the groups among the layers, and in them, that have nothing but groups in them. */
function removeEmptyGroups(vl: VectorLayer, layerIds: ReadonlyArray<string>) {
  const emptyIds = layerIds
    .map(id => vl.findLayerById(id))
    .filter(layer => layer !== undefined)
    .flatMap(layer => LayerUtil.runPreorderTraversal(layer))
    .filter(
      layer =>
        layer instanceof GroupLayer &&
        LayerUtil.runPreorderTraversal(layer).every(l => l instanceof GroupLayer),
    )
    .map(layer => layer.id);
  return emptyIds.length ? LayerUtil.removeLayers(vl, ...emptyIds) : vl;
}

/** Describes the layers, for the snackbar: the path's name, or how many paths there are. */
function describeLayerSet(document: LayerDocument, layerIds: ReadonlyArray<string>) {
  const paths = layerIds
    .map(id => document.vectorLayer.findLayerById(id))
    .filter(layer => layer !== undefined)
    .flatMap(layer => LayerUtil.runPreorderTraversal(layer))
    .filter(layer => layer instanceof PathLayer);
  return paths.length === 1 ? paths[0].name : `${paths.length} paths`;
}
