import * as XmlSerializer from './XmlSerializer';
import { Layer, VectorLayer, PathLayer, GroupLayer, ClipPathLayer } from '../model/layers';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';

function conditionalAttr_(node, attr, value, skipValue?) {
  if (value !== undefined
    && value !== null
    && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(ANDROID_NS, attr, value);
  }
}

function serializeXmlNode_(xmlNode) {
  return XmlSerializer.serializeToString(xmlNode, { indent: 4, multiAttributeIndent: 4 });
}

/**
 * Serializes an VectorLayer to a vector drawable XML file.
 */
export function vectorLayerToVectorDrawableXmlString(vectorLayer: VectorLayer) {
  const xmlDoc = document.implementation.createDocument(null, 'vector', null);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToXmlNode_(vectorLayer, rootNode, xmlDoc);
  return serializeXmlNode_(rootNode);
}

/**
 * Serializes a given VectorLayer and Animation to an animatedvector drawable XML file.
 */
export function vectorLayerAnimationToAvdXmlString(vectorLayer, animation) {
  const xmlDoc = document.implementation.createDocument(null, 'animated-vector', null);
  const rootNode = xmlDoc.documentElement;
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:aapt', AAPT_NS);

  // Create drawable node containing the vector layer.
  const vectorLayerContainerNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
  vectorLayerContainerNode.setAttribute('name', 'android:drawable');
  rootNode.appendChild(vectorLayerContainerNode);

  const vectorLayerNode = xmlDoc.createElement('vector');
  vectorLayerToXmlNode_(vectorLayer, vectorLayerNode, xmlDoc);
  vectorLayerContainerNode.appendChild(vectorLayerNode);

  // Create animation nodes (one per layer).
  const animBlocksByLayer = {};
  animation.blocks.forEach(block => {
    animBlocksByLayer[block.layerId] = animBlocksByLayer[block.layerId] || [];
    animBlocksByLayer[block.layerId].push(block);
  });

  for (const layerId in animBlocksByLayer) {
    if (!animBlocksByLayer.hasOwnProperty(layerId)) {
      continue;
    }
    const targetNode = xmlDoc.createElement('target');
    targetNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
    rootNode.appendChild(targetNode);

    const animationNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
    animationNode.setAttribute('name', 'android:animation');
    targetNode.appendChild(animationNode);

    const blocksForLayer = animBlocksByLayer[layerId];
    let blockContainerNode = animationNode;
    let multiBlock = false;
    if (blocksForLayer.length > 1) {
      multiBlock = true;

      // <set> for multiple property animations on a single layer
      blockContainerNode = xmlDoc.createElement('set');
      blockContainerNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
      animationNode.appendChild(blockContainerNode);
    }

    const layer = vectorLayer.findLayerById(layerId);
    const animatableProperties = layer.animatableProperties;

    blocksForLayer.forEach(block => {
      const blockNode = xmlDoc.createElement('objectAnimator');
      if (!multiBlock) {
        blockNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
      }
      blockNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
      blockNode.setAttributeNS(ANDROID_NS, 'android:propertyName', block.propertyName);
      conditionalAttr_(blockNode, 'android:startOffset', block.startTime, 0);
      conditionalAttr_(blockNode, 'android:duration', block.endTime - block.startTime);
      conditionalAttr_(blockNode, 'android:valueFrom', block.fromValue);
      conditionalAttr_(blockNode, 'android:valueTo', block.toValue);
      conditionalAttr_(blockNode, 'android:valueType',
        animatableProperties[block.propertyName].animatorValueType);
      conditionalAttr_(blockNode, 'android:interpolator', block.interpolator.androidRef);
      blockContainerNode.appendChild(blockNode);
    });
  }

  return serializeXmlNode_(rootNode);
}

/**
 * Helper method that serializes a VectorLayer to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
export function vectorLayerToXmlNode_(vl: VectorLayer, destinationNode, xmlDoc: Document) {
  destinationNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:width', `${vl.width}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:height', `${vl.height}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportWidth', `${vl.width}`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportHeight', `${vl.height}`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:alpha', `${vl.alpha}`);

  walk(vl, (layer, parentNode) => {
    if (layer instanceof VectorLayer) {
      return parentNode;

    } else if (layer instanceof PathLayer) {
      const node = xmlDoc.createElement('path');
      conditionalAttr_(node, 'android:name', layer.id);
      conditionalAttr_(node, 'android:pathData', layer.pathData.pathString);
      conditionalAttr_(node, 'android:fillColor', layer.fillColor, '');
      conditionalAttr_(node, 'android:fillAlpha', layer.fillAlpha, 1);
      conditionalAttr_(node, 'android:strokeColor', layer.strokeColor, '');
      conditionalAttr_(node, 'android:strokeAlpha', layer.strokeAlpha, 1);
      conditionalAttr_(node, 'android:strokeWidth', layer.strokeWidth, 0);
      conditionalAttr_(node, 'android:trimPathStart', layer.trimPathStart, 0);
      conditionalAttr_(node, 'android:trimPathEnd', layer.trimPathEnd, 1);
      conditionalAttr_(node, 'android:trimPathOffset', layer.trimPathOffset, 0);
      conditionalAttr_(node, 'android:strokeLineCap', layer.strokeLinecap, 'butt');
      conditionalAttr_(node, 'android:strokeLineJoin', layer.strokeLinejoin, 'miter');
      conditionalAttr_(node, 'android:strokeMiterLimit', layer.strokeMiterLimit, 4);
      parentNode.appendChild(node);
      return parentNode;

    } else if (layer instanceof ClipPathLayer) {
      const node = xmlDoc.createElement('clip-path');
      conditionalAttr_(node, 'android:name', layer.id);
      conditionalAttr_(node, 'android:pathData', layer.pathData.pathString);
      parentNode.appendChild(node);
      return parentNode;

    } else if (layer instanceof GroupLayer) {
      const node = xmlDoc.createElement('group');
      conditionalAttr_(node, 'android:name', layer.id);
      conditionalAttr_(node, 'android:pivotX', layer.pivotX, 0);
      conditionalAttr_(node, 'android:pivotY', layer.pivotY, 0);
      conditionalAttr_(node, 'android:translateX', layer.translateX, 0);
      conditionalAttr_(node, 'android:translateY', layer.translateY, 0);
      conditionalAttr_(node, 'android:scaleX', layer.scaleX, 1);
      conditionalAttr_(node, 'android:scaleY', layer.scaleY, 1);
      conditionalAttr_(node, 'android:rotation', layer.rotation, 0);
      parentNode.appendChild(node);
      return node;
    }
  }, destinationNode);
}


function walk(layer: VectorLayer, fn, context) {
  const visit_ = (l: Layer, ctx) => {
    const childCtx = fn(l, ctx);
    if (l.children) {
      l.children.forEach(child => visit_(child, childCtx));
    }
  };
  visit_(layer, context);
}
