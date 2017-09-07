import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/model/layers';
import { ColorUtil } from 'app/scripts/common';
import * as paper from 'paper';

export class VectorLayerGroup extends paper.Group {
  constructor(vl: VectorLayer) {
    super();
    this.data.id = vl.id;
    this.opacity = vl.alpha;
    this.addChildren(
      vl.children.map(function recurseFn(layer: Layer) {
        if (layer instanceof PathLayer) {
          // TODO: return a compound path instead
          return fromPathLayer(layer);
        }
        if (layer instanceof ClipPathLayer) {
          // TODO: return a compound path instead
          return fromClipPathLayer(layer);
        }
        if (layer instanceof GroupLayer) {
          const groupItem = fromGroupLayer(layer);
          groupItem.addChildren(layer.children.map(l => recurseFn(l)));
          return groupItem;
        }
        throw new TypeError('Unknown layer type: ' + layer);
      }),
    );
  }
}

function fromPathLayer(layer: PathLayer) {
  const { fillColor, fillAlpha, strokeColor, strokeAlpha } = layer;
  const { trimPathStart, trimPathEnd, trimPathOffset } = layer;
  // TODO: make sure this works with compound paths as well (Android behavior is different)
  const pathLength = layer.pathData ? layer.pathData.getPathLength() : 0;
  const dashArray = pathLength
    ? LayerUtil.toStrokeDashArray(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
    : undefined;
  const dashOffset = pathLength
    ? LayerUtil.toStrokeDashOffset(trimPathStart, trimPathEnd, trimPathOffset, pathLength)
    : undefined;
  const f = ColorUtil.parseAndroidColor(fillColor);
  const s = ColorUtil.parseAndroidColor(strokeColor);
  // TODO: import a compound path instead
  return new paper.Path({
    data: { id: layer.id },
    pathData: layer.pathData ? layer.pathData.getPathString() : '',
    fillColor: f ? new paper.Color(f.r, f.g, f.b, f.a * fillAlpha) : undefined,
    strokeColor: s ? new paper.Color(s.r, s.g, s.b, s.a * strokeAlpha) : undefined,
    strokeWidth: layer.strokeWidth,
    miterLimit: layer.strokeMiterLimit,
    strokeJoin: layer.strokeLinejoin,
    strokeCap: layer.strokeLinecap,
    fillRule: layer.fillType === 'evenOdd' ? 'evenodd' : 'nonzero',
    dashArray,
    dashOffset,
  });
}

function fromClipPathLayer(layer: ClipPathLayer) {
  return new paper.Path({
    data: { id: layer.id },
    pathData: layer.pathData ? layer.pathData.getPathString() : '',
    clipMask: true,
  });
}

function fromGroupLayer(layer: GroupLayer) {
  const { pivotX, pivotY, scaleX, scaleY, rotation, translateX, translateY } = layer;
  const pivot = new paper.Matrix(1, 0, 0, 1, pivotX, pivotY);
  const scale = new paper.Matrix(scaleX, 0, 0, scaleY, 0, 0);
  const cosr = Math.cos(rotation * Math.PI / 180);
  const sinr = Math.sin(rotation * Math.PI / 180);
  const rotate = new paper.Matrix(cosr, sinr, -sinr, cosr, 0, 0);
  const translate = new paper.Matrix(1, 0, 0, 1, translateX, translateY);
  const matrix = new paper.Matrix()
    .prepend(pivot.inverted())
    .prepend(scale)
    .prepend(rotate)
    .prepend(translate)
    .prepend(pivot);
  return new paper.Group({
    data: { id: layer.id },
    matrix,
  });
}
