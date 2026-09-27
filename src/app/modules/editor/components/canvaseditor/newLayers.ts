import type { CanvasDocument } from 'app/modules/editor/components/canvas/CanvasPreview';
import {
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { MathUtil, Matrix, Point } from 'app/modules/editor/scripts/common';
import { round } from 'lodash-es';

// Filled black, like most icons, and lines and drawn paths stroked, a viewport unit wide.
const FILL_COLOR = '#000000';
const STROKE_COLOR = '#000000';
const STROKE_WIDTH = 1;
// How far a circle's control points are from its points, as a fraction of its radius.
const KAPPA = (4 * (Math.SQRT2 - 1)) / 3;

/** Where a new layer goes, and the matrix from viewport coordinates to its coordinates there. */
export interface NewLayerPlace {
  readonly parentId: string;
  readonly index: number;
  readonly toLocal: Matrix;
}

/**
 * Returns where new layers go, like Figma: at the top of the selected group, or just above the
 * selected layer, or else at the top of the vector layer.
 */
export function getNewLayerSpot(vl: VectorLayer, selectedLayerIds: ReadonlySet<string>) {
  if (selectedLayerIds.size === 1) {
    const [layerId] = selectedLayerIds;
    const layer = vl.findLayerById(layerId);
    if (layer instanceof GroupLayer) {
      return { parentId: layer.id, index: layer.children.length };
    }
    const parent = layer && LayerUtil.findParent(vl, layer.id);
    if (layer && parent) {
      return { parentId: parent.id, index: parent.children.indexOf(layer) + 1 };
    }
  }
  return { parentId: vl.id, index: vl.children.length };
}

/**
 * Returns where a new layer goes (see getNewLayerSpot), with the matrix into its coordinates as
 * it's drawn at the current time. A layer in a hidden group, or in one scaled to 0, couldn't be
 * seen, so it goes above that group, in the closest one that it can be seen in.
 */
export function getNewLayerPlace(
  document: CanvasDocument,
  selectedLayerIds: ReadonlySet<string>,
  hiddenLayerIds: ReadonlySet<string>,
  render: (document: CanvasDocument) => VectorLayer,
): NewLayerPlace {
  const vl = document.vectorLayer;
  const isHidden = (layerId: string) => {
    for (let id: string | undefined = layerId; id; id = LayerUtil.findParent(vl, id)?.id) {
      if (hiddenLayerIds.has(id)) {
        return true;
      }
    }
    return false;
  };
  let { parentId, index } = getNewLayerSpot(vl, selectedLayerIds);
  while (parentId !== vl.id) {
    const toLocal = isHidden(parentId) ? undefined : getToLocal(document, parentId, index, render);
    if (toLocal) {
      return { parentId, index, toLocal };
    }
    const parent = LayerUtil.findParent(vl, parentId);
    if (!parent) {
      break;
    }
    index = parent.children.findIndex(child => child.id === parentId) + 1;
    parentId = parent.id;
  }
  if (parentId !== vl.id) {
    index = vl.children.length;
  }
  return {
    parentId: vl.id,
    index,
    toLocal: getToLocal(document, vl.id, index, render) ?? Matrix.identity(),
  };
}

/** Adds the layer where the place says. */
export function addNewLayer(document: CanvasDocument, place: NewLayerPlace, layer: Layer) {
  return addLayerAt(document, place.parentId, place.index, layer);
}

function addLayerAt(document: CanvasDocument, parentId: string, index: number, layer: Layer) {
  return {
    vectorLayer: LayerUtil.addLayers(document.vectorLayer, parentId, index, layer),
    animation: document.animation,
  };
}

function getToLocal(
  document: CanvasDocument,
  parentId: string,
  index: number,
  render: (document: CanvasDocument) => VectorLayer,
) {
  const placeholder = new PathLayer({ name: '', children: [], pathData: undefined });
  const rendered = render(addLayerAt(document, parentId, index, placeholder));
  return LayerUtil.getCanvasTransformForLayer(rendered, placeholder.id).invert();
}

/**
 * Returns a new path layer, filled or stroked, with a name that no other layer has. A stroke is a
 * viewport unit wide, whatever the artboard's size, so a line on a big artboard isn't drawn with a
 * thick stroke. It's in the place's coordinates, so it still looks a unit wide in a scaled group.
 */
export function createPathLayer(
  vl: VectorLayer,
  name: string,
  pathData: Path,
  style: 'filled' | 'stroked',
  place: NewLayerPlace,
) {
  const width = STROKE_WIDTH * place.toLocal.getScaleFactor();
  return new PathLayer({
    name: LayerUtil.getUniqueLayerName([vl], name),
    children: [],
    pathData,
    ...(style === 'filled'
      ? { fillColor: FILL_COLOR }
      : { strokeColor: STROKE_COLOR, strokeWidth: round(width, 3) || STROKE_WIDTH }),
  });
}

/** Returns a path through points given in viewport coordinates, in the layer's coordinates. */
export function toLocalPath(
  toLocal: Matrix,
  commands: ReadonlyArray<readonly [string, ...Point[]]>,
) {
  const format = (p: Point) => {
    const { x, y } = MathUtil.transformPoint(p, toLocal);
    // The precision that paths are saved at.
    return `${round(x, 3)} ${round(y, 3)}`;
  };
  return new Path(
    commands.map(([type, ...points]) => [type, ...points.map(format)].join(' ')).join(' '),
  );
}

/** A rectangle between two corners, in viewport coordinates, going clockwise from the top left. */
export function rectangleCommands(a: Point, b: Point): Array<[string, ...Point[]]> {
  const [l, r] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [t, bottom] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  return [
    ['M', { x: l, y: t }],
    ['L', { x: r, y: t }],
    ['L', { x: r, y: bottom }],
    ['L', { x: l, y: bottom }],
    ['Z'],
  ];
}

/**
 * An ellipse in the box between two corners, in viewport coordinates, as four cubic curves going
 * clockwise from the top.
 */
export function ellipseCommands(a: Point, b: Point): Array<[string, ...Point[]]> {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.abs(b.x - a.x) / 2;
  const ry = Math.abs(b.y - a.y) / 2;
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const p = (x: number, y: number) => ({ x: cx + x, y: cy + y });
  return [
    ['M', p(0, -ry)],
    ['C', p(kx, -ry), p(rx, -ky), p(rx, 0)],
    ['C', p(rx, ky), p(kx, ry), p(0, ry)],
    ['C', p(-kx, ry), p(-rx, ky), p(-rx, 0)],
    ['C', p(-rx, -ky), p(-kx, -ry), p(0, -ry)],
    ['Z'],
  ];
}

/** A line between two points, in viewport coordinates. */
export function lineCommands(a: Point, b: Point): Array<[string, ...Point[]]> {
  return [
    ['M', a],
    ['L', b],
  ];
}
