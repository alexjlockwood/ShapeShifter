import { ClipPathLayer, GroupLayer, Layer, PathLayer, VectorLayer } from 'app/model/layers';
import * as paper from 'paper';

// TODO: move this somewhere else?
export function fromLayer(vl: VectorLayer) {
  return (function recurseFn(layer: Layer) {
    if (layer instanceof PathLayer) {
      // TODO: what to do about the 'stroke scaling' property for items?
      // TODO: support compound paths
      const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
      const item = new paper.Path(pathStr);
      item.applyMatrix = false;
      item.fillColor = layer.fillColor;
      item.strokeColor = layer.strokeColor;
      item.strokeWidth = layer.strokeWidth;
      item.miterLimit = layer.strokeMiterLimit;
      item.strokeJoin = layer.strokeLinejoin;
      item.strokeCap = layer.strokeLinecap;
      if (layer.fillType === 'evenOdd') {
        // Note that the 'o' is intentionally not capitalized here.
        item.fillRule = 'evenodd';
      }
      // TODO: convert trim path properties to/from stroke dash array
      // TODO: deal with fill and stroke opacity!!!!!
      const { trimPathStart, trimPathEnd, trimPathOffset, fillAlpha, strokeAlpha } = layer;
      item.data = {
        trimPathStart,
        trimPathEnd,
        trimPathOffset,
        fillAlpha,
        strokeAlpha,
      };
      return item;
    }
    if (layer instanceof ClipPathLayer) {
      // TODO: support compound paths
      const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
      const item = new paper.Path(pathStr);
      item.applyMatrix = false;
      item.clipMask = true;
      return item;
    }
    if (layer instanceof GroupLayer) {
      const item = new paper.Group();
      item.applyMatrix = false;
      const { pivotX, pivotY, scaleX, scaleY, translateX, translateY, rotation } = layer;
      item.data = {
        pivotX,
        pivotY,
        scaleX,
        scaleY,
        translateX,
        translateY,
        rotation,
      };
      const children = layer.children.map(l => recurseFn(l));
      item.addChildren(children);
      return item;
    }
    if (layer instanceof VectorLayer) {
      const item = new paper.Group();
      item.applyMatrix = false;
      const children = layer.children.map(l => recurseFn(l));
      item.addChildren(children);
      return item;
    }
    throw new TypeError('Unknown layer type: ' + layer);
  })(vl) as paper.Group;
}
