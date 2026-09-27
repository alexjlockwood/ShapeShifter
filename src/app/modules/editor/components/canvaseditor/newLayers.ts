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

// Like Figma's defaults: shapes are filled, and lines and drawn paths are stroked.
const FILL_COLOR = '#000000';
const STROKE_COLOR = '#000000';
const STROKE_WIDTH = 1;
// How far a circle's control points are from its points, as a fraction of its radius.
const KAPPA = (4 * (Math.SQRT2 - 1)) / 3;

/**
 * Returns the layer that new layers go into: the selected group, or the parent of the selected
 * layer, where the new one goes above it, or else the vector layer.
 */
export function getNewLayerParentId(vl: VectorLayer, selectedLayerIds: ReadonlySet<string>) {
  if (selectedLayerIds.size === 1) {
    const [layerId] = selectedLayerIds;
    const layer = vl.findLayerById(layerId);
    if (layer instanceof GroupLayer) {
      return layer.id;
    }
    const parent = layer && LayerUtil.findParent(vl, layer.id);
    if (parent) {
      return parent.id;
    }
  }
  return vl.id;
}

/** Adds the layer to the top of the parent's layers. */
export function addNewLayer(document: CanvasDocument, parentId: string, layer: Layer) {
  const parent = document.vectorLayer.findLayerById(parentId);
  return {
    vectorLayer: LayerUtil.addLayers(
      document.vectorLayer,
      parentId,
      parent?.children.length ?? 0,
      layer,
    ),
    animation: document.animation,
  };
}

/**
 * Returns the matrix from viewport coordinates to the coordinates of a new layer in the parent,
 * as it's drawn at the current time.
 */
export function getNewLayerToLocal(
  document: CanvasDocument,
  parentId: string,
  render: (document: CanvasDocument) => VectorLayer,
) {
  const placeholder = new PathLayer({ name: '', children: [], pathData: undefined });
  const rendered = render(addNewLayer(document, parentId, placeholder));
  // A group scaled to 0 can't be drawn into, so this draws as if it weren't there.
  return (
    LayerUtil.getCanvasTransformForLayer(rendered, placeholder.id).invert() ?? Matrix.identity()
  );
}

/** Returns a new path layer, filled or stroked, with a name that no other layer has. */
export function createPathLayer(
  vl: VectorLayer,
  name: string,
  pathData: Path,
  style: 'filled' | 'stroked',
) {
  return new PathLayer({
    name: LayerUtil.getUniqueLayerName([vl], name),
    children: [],
    pathData,
    ...(style === 'filled'
      ? { fillColor: FILL_COLOR }
      : { strokeColor: STROKE_COLOR, strokeWidth: STROKE_WIDTH }),
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
