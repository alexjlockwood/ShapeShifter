import * as XmlSerializer from './XmlSerializer';
import { Layer, VectorLayer, PathLayer, GroupLayer } from '../layers';
import { ColorUtil } from '../common';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Serializes an VectorLayer to a vector drawable XML file.
 */
export function vectorLayerToSvgString(
  vectorLayer: VectorLayer, width?: number, height?: number, x?: number, y?: number) {

  const xmlDoc = document.implementation.createDocument(null, 'svg', null);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToSvgNode(vectorLayer, rootNode, xmlDoc);
  if (width !== undefined) {
    rootNode.setAttributeNS(null, 'width', width.toString() + 'px');
  }
  if (height !== undefined) {
    rootNode.setAttributeNS(null, 'height', height.toString() + 'px');
  }
  if (x !== undefined) {
    rootNode.setAttributeNS(null, 'x', x.toString() + 'px');
  }
  if (y !== undefined) {
    rootNode.setAttributeNS(null, 'y', y.toString() + 'px');
  }
  return serializeXmlNode(rootNode);
}

/**
 * Helper method that serializes a VectorLayer to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
function vectorLayerToSvgNode(vl: VectorLayer, destinationNode: HTMLElement, xmlDoc: Document) {
  destinationNode.setAttributeNS(XMLNS_NS, 'xmlns', SVG_NS);
  destinationNode.setAttributeNS(null, 'viewBox', `0 0 ${vl.width} ${vl.height}`);
  conditionalAttr(destinationNode, 'opacity', vl.alpha, 1);

  walk(vl, (layer, parentNode) => {
    if (layer instanceof VectorLayer) {
      return parentNode;

    } else if (layer instanceof PathLayer) {
      const node = xmlDoc.createElement('path');
      conditionalAttr(node, 'id', layer.id);
      conditionalAttr(node, 'd', layer.pathData.getPathString());
      if (layer.fillColor) {
        conditionalAttr(node, 'fill', ColorUtil.androidToCssColor(layer.fillColor), '');
      } else {
        conditionalAttr(node, 'fill', 'none');
      }
      conditionalAttr(node, 'fill-opacity', layer.fillAlpha, 1);
      if (layer.strokeColor) {
        conditionalAttr(node, 'stroke', ColorUtil.androidToCssColor(layer.strokeColor), '');
      }
      conditionalAttr(node, 'stroke-opacity', layer.strokeAlpha, 1);
      conditionalAttr(node, 'stroke-width', layer.strokeWidth, 0);
      // TODO: support exporting trim paths to SVG
      // conditionalAttr(node, 'android:trimPathStart', layer.trimPathStart, 0);
      // conditionalAttr(node, 'android:trimPathEnd', layer.trimPathEnd, 1);
      // conditionalAttr(node, 'android:trimPathOffset', layer.trimPathOffset, 0);
      conditionalAttr(node, 'stroke-linecap', layer.strokeLinecap, 'butt');
      conditionalAttr(node, 'stroke-linejoin', layer.strokeLinejoin, 'miter');
      conditionalAttr(node, 'stroke-miterlimit', layer.strokeMiterLimit, 4);
      const fillRule =
        !layer.fillType || layer.fillType === 'nonZero' ? 'nonzero' : 'evenodd';
      conditionalAttr(node, 'fill-rule', fillRule, 'nonzero');
      parentNode.appendChild(node);
      return parentNode;

    } else if (layer instanceof GroupLayer) {
      const node = xmlDoc.createElement('g');
      conditionalAttr(node, 'id', layer.id);
      const transformValues: string[] = [];
      if (layer.scaleX !== 1 || layer.scaleY !== 1) {
        transformValues.push(`scale(${layer.scaleX} ${layer.scaleY}`);
      }
      if (layer.rotation) {
        transformValues.push(`rotate(${layer.rotation} ${layer.pivotX} ${layer.pivotY})`);
      }
      if (layer.translateX || layer.translateY) {
        transformValues.push(`translate(${layer.translateX} ${layer.translateY})`);
      }
      if (transformValues.length) {
        node.setAttributeNS(null, 'transform', transformValues.join(' '));
      }
      parentNode.appendChild(node);
      return node;
    }
    // TODO: support exporting clip paths to SVG
    /* else if (layer instanceof ClipPathLayer) {
    const node = xmlDoc.createElement('clip-path');
    conditionalAttr(node, '', layer.id);
    conditionalAttr(node, 'android:pathData', layer.pathData.getPathString());
    parentNode.appendChild(node);
    return parentNode;
    }*/
  }, destinationNode);
}

function conditionalAttr(node: HTMLElement, attr, value, skipValue?) {
  if (value !== undefined
    && value !== null
    && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(null, attr, value);
  }
}

function serializeXmlNode(xmlNode: HTMLElement) {
  return XmlSerializer.serializeToString(xmlNode, { indent: 4, multiAttributeIndent: 4 });
}

function walk(layer: VectorLayer, fn, context) {
  const visitFn = (l: Layer, ctx) => {
    const childCtx = fn(l, ctx);
    if (l.children) {
      l.children.forEach(child => visitFn(child, childCtx));
    }
  };
  visitFn(layer, context);
}
