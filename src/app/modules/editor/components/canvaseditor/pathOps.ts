import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import { getTopmostLayerIds } from 'app/modules/editor/components/canvas/transformLayers';
import { LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Matrix } from 'app/modules/editor/scripts/common';
import { uniqueId } from 'lodash-es';
import type { PathKit, SkPath } from 'pathkit-wasm/bin/pathkit.js';
import wasmUrl from 'pathkit-wasm/bin/pathkit.wasm?url';

// Boolean operations and outlining strokes use Skia's PathOps, through PathKit, which is loaded the
// first time one of them is used (docs/canvas-editor.md, phase 6).

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

let pathKit: Promise<PathKit> | undefined;

/** Downloads PathKit the first time it's called, and again after a download that failed. */
export function loadPathKit() {
  pathKit ??= import('pathkit-wasm/bin/pathkit.js')
    .then(({ default: init }) => init({ locateFile: () => wasmUrl }))
    .catch((error: unknown) => {
      pathKit = undefined;
      throw error;
    });
  return pathKit;
}

/**
 * Returns the layers a boolean operation combines, bottom first, or undefined if it can't: it
 * takes two or more paths (not clip paths) whose paths aren't animated, since the result replaces
 * them with one path.
 */
export function getBooleanLayerIds(document: CanvasDocument, selectedLayerIds: Iterable<string>) {
  const layerIds = getTopmostLayerIds(document.vectorLayer, selectedLayerIds);
  const isCombinable = (id: string) => {
    const layer = document.vectorLayer.findLayerById(id);
    return layer instanceof PathLayer && !!layer.pathData && !isPathAnimated(document, id);
  };
  return layerIds.length > 1 && layerIds.every(isCombinable) ? layerIds : undefined;
}

/** Returns the stroked paths that outlining their strokes changes, if there are any. */
export function getOutlineLayerIds(document: CanvasDocument, selectedLayerIds: Iterable<string>) {
  const layerIds = getTopmostLayerIds(document.vectorLayer, selectedLayerIds).filter(id => {
    const layer = document.vectorLayer.findLayerById(id);
    return (
      layer instanceof PathLayer &&
      !!layer.pathData &&
      !!layer.strokeColor &&
      layer.strokeWidth > 0 &&
      // Its stroke's width and trim, as well as its path, would stop animating.
      !document.animation.blocks.some(block => block.layerId === id)
    );
  });
  return layerIds.length ? layerIds : undefined;
}

/**
 * Combines the paths, as they're drawn on the canvas, into the bottom one, which keeps its style,
 * and removes the others, as Figma's flatten does after a boolean operation. Returns the new
 * document and the combined layer's id, or undefined if nothing's left, e.g. after intersecting
 * paths that don't overlap.
 */
export function combinePaths(
  pk: PathKit,
  document: CanvasDocument,
  layerIds: ReadonlyArray<string>,
  op: BooleanOp,
) {
  const { vectorLayer, animation } = document;
  const [targetId, ...otherIds] = layerIds;
  const target = vectorLayer.findLayerById(targetId);
  if (!(target instanceof PathLayer) || !otherIds.length) {
    throw new Error('Combine two or more paths');
  }
  const pathOp = {
    union: pk.PathOp.UNION,
    subtract: pk.PathOp.DIFFERENCE,
    intersect: pk.PathOp.INTERSECT,
    exclude: pk.PathOp.XOR,
  }[op];
  const paths: SkPath[] = [];
  try {
    const toSkPath = (id: string) => {
      const skPath = toViewportSkPath(pk, vectorLayer, id);
      paths.push(skPath);
      return skPath;
    };
    const result = toSkPath(targetId).copy();
    paths.push(result);
    for (const id of otherIds) {
      if (!result.op(toSkPath(id), pathOp)) {
        throw new Error(`Couldn't ${op} the paths`);
      }
    }
    const pathData = toLocalPathData(result, vectorLayer, targetId);
    if (!pathData) {
      return undefined;
    }
    const combined = target.clone();
    combined.pathData = new Path(pathData);
    combined.fillType = result.getFillTypeString() === 'evenodd' ? 'evenOdd' : 'nonZero';
    const removed = new Set(otherIds);
    let edited = LayerUtil.replaceLayer(vectorLayer, targetId, combined);
    edited = LayerUtil.removeLayers(edited, ...otherIds);
    const blocks = animation.blocks.filter(block => !removed.has(block.layerId));
    const editedAnimation = animation.clone();
    editedAnimation.blocks = blocks;
    return {
      document: {
        vectorLayer: edited,
        animation: blocks.length === animation.blocks.length ? animation : editedAnimation,
      },
      layerId: targetId,
    };
  } finally {
    paths.forEach(path => path.delete());
  }
}

/**
 * Turns the strokes of the paths into filled outlines, in the paths' own coordinates, with the
 * trim applied. A path with a fill keeps it, with a new path for the outline just above it.
 * Returns the new document and the outlines' layer ids.
 */
export function outlineStrokes(
  pk: PathKit,
  document: CanvasDocument,
  layerIds: ReadonlyArray<string>,
) {
  let { vectorLayer } = document;
  const outlineIds: string[] = [];
  const usedNames = new Set(LayerUtil.runPreorderTraversal(vectorLayer).map(l => l.name));
  for (const layerId of layerIds) {
    const layer = vectorLayer.findLayerById(layerId);
    if (!(layer instanceof PathLayer) || !layer.pathData) {
      continue;
    }
    const pathData = outlineStroke(pk, layer);
    if (!pathData) {
      continue;
    }
    const outline = layer.clone();
    outline.pathData = new Path(pathData);
    outline.fillColor = layer.strokeColor;
    outline.fillAlpha = layer.strokeAlpha;
    outline.fillType = 'nonZero';
    outline.strokeColor = '';
    outline.strokeWidth = 0;
    outline.trimPathStart = 0;
    outline.trimPathEnd = 1;
    outline.trimPathOffset = 0;
    const hasFill = !!layer.fillColor && layer.fillAlpha > 0;
    if (!hasFill) {
      vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, outline);
      outlineIds.push(layerId);
      continue;
    }
    // The fill stays where it was, without the stroke, and the outline goes just above it.
    const fill = layer.clone();
    fill.strokeColor = '';
    fill.strokeWidth = 0;
    outline.id = uniqueId();
    outline.name = LayerUtil.getUniqueName(`${layer.name}_outline`, name => usedNames.has(name));
    usedNames.add(outline.name);
    const parent = LayerUtil.findParent(vectorLayer, layerId);
    if (!parent) {
      continue;
    }
    const index = parent.children.findIndex(child => child.id === layerId);
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, fill);
    vectorLayer = LayerUtil.addLayers(vectorLayer, parent.id, index + 1, outline);
    outlineIds.push(outline.id);
  }
  return { document: { vectorLayer, animation: document.animation }, layerIds: outlineIds };
}

function outlineStroke(pk: PathKit, layer: PathLayer) {
  const skPath = pk.FromSVGString(layer.pathData?.getPathString() ?? '');
  if (!skPath) {
    return undefined;
  }
  try {
    if (!trim(skPath, layer)) {
      return undefined;
    }
    const joins = {
      miter: pk.StrokeJoin.MITER,
      round: pk.StrokeJoin.ROUND,
      bevel: pk.StrokeJoin.BEVEL,
    };
    const caps = {
      butt: pk.StrokeCap.BUTT,
      round: pk.StrokeCap.ROUND,
      square: pk.StrokeCap.SQUARE,
    };
    const stroked = skPath.stroke({
      width: layer.strokeWidth,
      join: joins[layer.strokeLinejoin] ?? pk.StrokeJoin.MITER,
      cap: caps[layer.strokeLinecap] ?? pk.StrokeCap.BUTT,
      miter_limit: layer.strokeMiterLimit,
    });
    // The outline overlaps itself where the path turns sharply or crosses itself.
    const simplified = stroked?.simplify();
    return simplified?.toSVGString() || undefined;
  } finally {
    skPath.delete();
  }
}

/**
 * Trims the path the way the canvas draws it (components/canvas/CanvasLayers.ts): with a dash as
 * long as the part that's kept, and a gap for the rest, measured along the first subpath. When the
 * start is past the end, or the offset moves them past the end, what's kept wraps around to the
 * start. Skia draws canvas dashes, so this keeps what the canvas shows, even in the other subpaths.
 * Returns whether anything's left.
 */
function trim(skPath: SkPath, { trimPathStart, trimPathEnd, trimPathOffset, pathData }: PathLayer) {
  if (trimPathStart === 0 && trimPathEnd === 1 && trimPathOffset === 0) {
    return true;
  }
  if (trimPathStart === trimPathEnd) {
    return false;
  }
  const length = pathData?.getSubPathLength(0) ?? 0;
  const [dash, gap] = LayerUtil.toStrokeDashArray(
    trimPathStart,
    trimPathEnd,
    trimPathOffset,
    length,
  );
  if (gap <= 0) {
    return true;
  }
  if (dash <= 0) {
    return false;
  }
  const phase = LayerUtil.toStrokeDashOffset(trimPathStart, trimPathEnd, trimPathOffset, length);
  return !!skPath.dash(dash, gap, phase);
}

/** The layer's path in viewport coordinates, with its fill rule. */
function toViewportSkPath(pk: PathKit, vl: VectorLayer, layerId: string) {
  const layer = vl.findLayerById(layerId) as PathLayer;
  const skPath = pk.FromSVGString(layer.pathData?.getPathString() ?? '');
  if (!skPath) {
    throw new Error(`Couldn't read the path of ${layer.name}`);
  }
  skPath.setFillType(layer.fillType === 'evenOdd' ? pk.FillType.EVENODD : pk.FillType.WINDING);
  applyMatrix(skPath, LayerUtil.getCanvasTransformForLayer(vl, layerId));
  return skPath;
}

/** Returns the path in the layer's own coordinates, or undefined if it's empty. */
function toLocalPathData(skPath: SkPath, vl: VectorLayer, layerId: string) {
  const toLocal = LayerUtil.getCanvasTransformForLayer(vl, layerId).invert();
  if (!toLocal) {
    throw new Error("The layer's transform can't be undone");
  }
  applyMatrix(skPath, toLocal);
  return skPath.toSVGString() || undefined;
}

function applyMatrix(skPath: SkPath, { a, b, c, d, e, f }: Matrix) {
  skPath.transform(a, c, e, b, d, f, 0, 0, 1);
}

function isPathAnimated(document: CanvasDocument, layerId: string) {
  return document.animation.blocks.some(
    block => block.layerId === layerId && block.propertyName === 'pathData',
  );
}
