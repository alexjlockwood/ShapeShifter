import { getTopmostLayerIds } from 'app/modules/editor/components/canvas/transformLayers';
import { LayerUtil, PathLayer } from 'app/modules/editor/model/layers';
import { Path, type SubPath } from 'app/modules/editor/model/paths';
import { commandsToString } from 'app/modules/editor/model/paths/PathParser';
import { uniqueId } from 'lodash-es';

import { Matrix } from './Matrix';
import type { Point } from './Point';
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
 * and removes the others. Each path is mapped into the bottom one's coordinates, inside its own
 * transform, so that it stays where it's drawn (LayerUtil.getCanvasTransformForLayer includes a
 * path's transform). The combined path keeps the bottom one's style, transform, name, id, and
 * animations, and gets an even-odd fill, so that a shape inside of another one is a hole in it
 * (e.g. two ellipses make a donut). Returns the new document and the combined path's id, or why it
 * can't.
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
 * none of them has more than one subpath. A path whose other subpaths are all holes in its first
 * stays as it is, since each piece keeps its holes. A path whose path is animated can't be split up, since
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
    .filter(layer => getDrawnSubPaths(layer).length > 1);
  if (!paths.length) {
    return undefined;
  }
  const breakable = paths.filter(path => getPieces(path).length > 1);
  if (!breakable.length) {
    return { reason: `${paths[0].name}'s subpaths are one shape and its holes` };
  }
  const morphing = breakable.find(path => isPathAnimated(animation, path.id));
  if (morphing) {
    return { reason: `${morphing.name}'s path is animated` };
  }
  const trimmed = breakable.find(path => isTrimmed(document, path));
  if (trimmed) {
    return { reason: `${trimmed.name} is trimmed` };
  }
  return { layerIds: breakable.map(path => path.id) };
}

/**
 * Splits each of the selected paths that has several subpaths into a path for each one, along with
 * the holes it cuts, so an outlined shape stays outlined. The pieces are in the order of their
 * subpaths, so the first is drawn at the bottom. Every piece keeps the path's style and transform,
 * so it stays where it's drawn. If the path doesn't use its transform yet, each piece pivots at
 * its own center instead, so it rotates and scales in place. The first piece keeps the path's id,
 * name, and animations. The
 * others go right above it, with new ids, unique names, and copies of its animation blocks, and
 * they're hidden if it is. Returns the new document, the pieces' ids, and the hidden layer ids, or
 * why it can't.
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
    // A pivot moves nothing until the path is transformed, so moving it changes no drawing.
    const recenter = !LayerUtil.pathUsesTransform(layer, animation);
    const [first, ...others] = getPieces(layer).map((pathString, i) => {
      const piece = layer.clone();
      piece.pathData = new Path(pathString);
      if (recenter) {
        Object.assign(piece, LayerUtil.getPathCenterPivot(piece.pathData));
      }
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
 * Returns the path's subpaths that draw something. The ones that collapse to a point, which action
 * mode adds for morphing, and lone moves are left out.
 */
function getDrawnSubPaths(layer: PathLayer) {
  return (layer.pathData?.getSubPaths() ?? []).filter(
    subPath => !subPath.isCollapsing() && subPath.getCommands().length > 1,
  );
}

/**
 * Returns the path strings of the pieces Break apart makes from the path: a piece for each drawn
 * subpath, with the holes it cuts.
 */
function getPieces(layer: PathLayer) {
  return groupHoles(layer, getDrawnSubPaths(layer)).map(group =>
    group.map(subPath => commandsToString(subPath.getCommands())).join(' '),
  );
}

/**
 * Groups each subpath that cuts a hole with the smallest filled subpath around it. A subpath cuts a
 * hole when the area just inside its edge isn't filled, under the path's fill type, so a shape
 * inside a hole, like a lock's keyhole, stays a piece of its own. Without a fill there are no
 * holes, and each subpath is its own piece.
 */
function groupHoles(layer: PathLayer, subPaths: ReadonlyArray<SubPath>) {
  if (!layer.isFilled() || subPaths.length < 2) {
    return subPaths.map(subPath => [subPath]);
  }
  const polygons = subPaths.map(flattenSubPath);
  const isFilledAt = (point: Point) => {
    const winding = polygons.reduce((sum, polygon) => sum + getWinding(polygon, point), 0);
    return layer.fillType === 'evenOdd' ? winding % 2 !== 0 : winding !== 0;
  };
  const insidePoints = polygons.map(getPointJustInside);
  const isHole = insidePoints.map(point => !!point && !isFilledAt(point));
  const groups = new Map<number, SubPath[]>();
  subPaths.forEach((subPath, i) => {
    let owner = i;
    const point = insidePoints[i];
    if (isHole[i] && point) {
      let ownerArea = Infinity;
      polygons.forEach((polygon, j) => {
        const area = Math.abs(getArea(polygon));
        if (!isHole[j] && getWinding(polygon, point) !== 0 && area < ownerArea) {
          owner = j;
          ownerArea = area;
        }
      });
    }
    groups.set(owner, [...(groups.get(owner) ?? []), subPath]);
  });
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

/** Returns points along the subpath's outline, with each curve split into straight lines. */
function flattenSubPath(subPath: SubPath) {
  const points: Point[] = [];
  for (const cmd of subPath.getCommands()) {
    const controlPoints = cmd.points.filter((p): p is Point => !!p);
    if ((cmd.type === 'C' || cmd.type === 'Q') && controlPoints.length === cmd.points.length) {
      for (let i = 1; i <= 8; i++) {
        points.push(getBezierPoint(controlPoints, i / 8));
      }
    } else {
      points.push(cmd.end);
    }
  }
  return points;
}

function getBezierPoint(points: ReadonlyArray<Point>, t: number): Point {
  if (points.length === 1) {
    return points[0];
  }
  const next = points.slice(1).map((p, i) => ({
    x: points[i].x + (p.x - points[i].x) * t,
    y: points[i].y + (p.y - points[i].y) * t,
  }));
  return getBezierPoint(next, t);
}

/** Returns how many times the closed polygon winds around the point, with its direction's sign. */
function getWinding(polygon: ReadonlyArray<Point>, point: Point) {
  let winding = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
    if (a.y <= point.y && b.y > point.y && cross > 0) {
      winding++;
    } else if (a.y > point.y && b.y <= point.y && cross < 0) {
      winding--;
    }
  });
  return winding;
}

function getArea(polygon: ReadonlyArray<Point>) {
  return polygon.reduce((sum, a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return sum + (a.x * b.y - b.x * a.y) / 2;
  }, 0);
}

/**
 * Returns a point a hair inside the polygon, next to the middle of its longest edge, or undefined
 * if it has no area there.
 */
function getPointJustInside(polygon: ReadonlyArray<Point>) {
  let longest = { a: polygon[0], b: polygon[0], length: 0 };
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > longest.length) {
      longest = { a, b, length };
    }
  });
  const { a, b, length } = longest;
  if (!length) {
    return undefined;
  }
  const step = length / 1000;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const normal = { x: (a.y - b.y) / length, y: (b.x - a.x) / length };
  return [1, -1]
    .map(side => ({ x: mid.x + normal.x * step * side, y: mid.y + normal.y * step * side }))
    .find(point => getWinding(polygon, point) !== 0);
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
