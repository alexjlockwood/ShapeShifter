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

import * as Items from './Items';

export function fromVectorLayer(vl: VectorLayer) {
  return (function recurseFn(layer: Layer) {
    if (layer instanceof PathLayer) {
      const { fillColor, fillAlpha, strokeColor, strokeAlpha } = layer;
      const { trimPathStart, trimPathEnd, trimPathOffset } = layer;
      const pathData = layer.pathData ? layer.pathData.getPathString() : '';
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
      return Items.newPath({
        data: { id: layer.id },
        pathData,
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
    if (layer instanceof ClipPathLayer) {
      // TODO: import a compound path instead
      const pathData = layer.pathData ? layer.pathData.getPathString() : '';
      return Items.newPath({
        data: { id: layer.id },
        pathData,
        clipMask: true,
      });
    }

    if (layer instanceof GroupLayer) {
      const item = Items.newGroup({ data: { id: layer.id } });
      const { pivotX, pivotY, scaleX, scaleY, rotation, translateX, translateY } = layer;
      const pivot = new paper.Matrix(1, 0, 0, 1, pivotX, pivotY);
      const scale = new paper.Matrix(scaleX, 0, 0, scaleY, 0, 0);
      const cosr = Math.cos(rotation * Math.PI / 180);
      const sinr = Math.sin(rotation * Math.PI / 180);
      const rotate = new paper.Matrix(cosr, sinr, -sinr, cosr, 0, 0);
      const translate = new paper.Matrix(1, 0, 0, 1, translateX, translateY);
      item.matrix = new paper.Matrix()
        .prepend(pivot.inverted())
        .prepend(scale)
        .prepend(rotate)
        .prepend(translate)
        .prepend(pivot);
      item.addChildren(layer.children.map(l => recurseFn(l)));
      return item;
    }
    if (layer instanceof VectorLayer) {
      // TODO: for some reason using Items.newGroup() doesn't work. investigate...
      // TODO: confirm that stroke scaling works as expected
      const item = Items.newGroup({ data: { id: layer.id } });
      item.addChildren(layer.children.map(l => recurseFn(l)));
      return item;
    }
    throw new TypeError('Unknown layer type: ' + layer);
  })(vl) as paper.Group;
}
