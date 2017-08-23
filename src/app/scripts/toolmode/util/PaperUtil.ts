import { ClipPathLayer, GroupLayer, Layer, PathLayer, VectorLayer } from 'app/model/layers';
import * as _ from 'lodash';
import * as paper from 'paper';

let isPaperJsSetup = false;

export function setupPaperJs(canvas: HTMLCanvasElement) {
  if (isPaperJsSetup) {
    return;
  }
  paper.setup(canvas);
  paper.settings.handleSize = 8;
  const defaultLayer = new paper.Layer();
  defaultLayer.name = 'Default layer';
  defaultLayer.data.isDefaultLayer = true;
  const guideLayer = new paper.Layer();
  guideLayer.name = 'Guide layer';
  guideLayer.data.isGuideLayer = true;
  guideLayer.bringToFront();
  defaultLayer.activate();
  isPaperJsSetup = true;
}

export function getAllPaperItems(includeGuides = false) {
  const allItems: paper.Item[] = [];
  for (const layer of paper.project.layers) {
    for (const child of layer.children) {
      if (includeGuides || !child.guide) {
        allItems.push(child);
      }
    }
  }
  return allItems;
}

/**
 * Returns the guide layer on which to draw temporary selections.
 */
export function findGuideLayer() {
  return _.find(paper.project.layers, l => l.data && l.data.isGuideLayer);
}

/**
 * Returns the first ancestor of 'item' that is a paper.Layer instance.
 */
export function findParentLayer(item: paper.Item) {
  return isLayer(item) ? item : findParentLayer(item.parent);
}

export function instanceOfPathItem(item: paper.Item): item is paper.PathItem {
  return item instanceof paper.PathItem;
}

export function isPath(item: paper.Item): item is paper.Path {
  return isSameClass(item, paper.Path);
}

export function isCompoundPath(item: paper.Item): item is paper.CompoundPath {
  return isSameClass(item, paper.CompoundPath);
}

export function isGroup(item: paper.Item): item is paper.Group {
  return isSameClass(item, paper.Group);
}

export function instanceofGroup(item: paper.Item): item is paper.Group {
  return item instanceof paper.Group;
}

export function isLayer(item: paper.Item): item is paper.Layer {
  return isSameClass(item, paper.Layer);
}

function isSameClass<T>(obj: any, cls: new (...args: any[]) => T): obj is T {
  return obj && obj.constructor === cls.constructor;
}

/**
 * Converts a VectorLayer into a paper.Group.
 */
export function fromLayer(vl: VectorLayer) {
  return (function recurseFn(layer: Layer) {
    if (layer instanceof PathLayer) {
      // TODO: what to do about the 'stroke scaling' property for items?
      const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
      const item = new paper.CompoundPath(pathStr);
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
      const pathStr = layer.pathData ? layer.pathData.getPathString() : '';
      const item = new paper.CompoundPath(pathStr);
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
