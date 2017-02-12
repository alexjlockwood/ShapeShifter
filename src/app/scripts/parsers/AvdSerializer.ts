import * as XmlSerializer from './XmlSerializer';
import { Layer, VectorLayer, PathLayer, GroupLayer, ClipPathLayer } from '../layers';
import { AvdTarget } from '../animation';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';

/**
 * Serializes an VectorLayer to a vector drawable XML file.
 */
export function vectorLayerToVectorDrawableXmlString(vectorLayer: VectorLayer) {
  const xmlDoc = document.implementation.createDocument(null, 'vector', null);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToXmlNode(vectorLayer, rootNode, xmlDoc);
  return serializeXmlNode(rootNode);
}

/**
 * Serializes a given VectorLayer and Animation to an animated vector drawable XML file.
 */
export function vectorLayerAnimationToAvdXmlString(
  vectorLayer: VectorLayer,
  avdTarget: AvdTarget) {

  const xmlDoc = document.implementation.createDocument(null, 'animated-vector', null);
  const rootNode = xmlDoc.documentElement;
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:aapt', AAPT_NS);

  // Create drawable node containing the vector layer.
  const vectorLayerContainerNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
  vectorLayerContainerNode.setAttribute('name', 'android:drawable');
  rootNode.appendChild(vectorLayerContainerNode);

  const vectorLayerNode = xmlDoc.createElement('vector');
  vectorLayerToXmlNode(vectorLayer, vectorLayerNode, xmlDoc);
  vectorLayerContainerNode.appendChild(vectorLayerNode);

  // TODO: eventually support passing in multiple animation targets?
  const animationTargets = [avdTarget];
  for (const target of animationTargets) {
    const layerId = target.layerId;
    const targetNode = xmlDoc.createElement('target');
    targetNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
    rootNode.appendChild(targetNode);

    const animationNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
    animationNode.setAttribute('name', 'android:animation');
    targetNode.appendChild(animationNode);

    const layer = vectorLayer.findLayerById(layerId);
    const animatorNode = xmlDoc.createElement('objectAnimator');
    animatorNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
    animatorNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
    animatorNode.setAttributeNS(ANDROID_NS, 'android:propertyName', target.propertyName);
    // conditionalAttr(animatorNode, 'android:startOffset', target.startTime, 0);
    conditionalAttr(animatorNode, 'android:duration', target.duration);
    conditionalAttr(animatorNode, 'android:valueFrom', target.valueFrom);
    conditionalAttr(animatorNode, 'android:valueTo', target.valueTo);
    conditionalAttr(animatorNode, 'android:valueType', target.valueType);
    conditionalAttr(animatorNode, 'android:interpolator', target.interpolator);
    animationNode.appendChild(animatorNode);
  }

  return serializeXmlNode(rootNode);
}

/**
 * Helper method that serializes a VectorLayer to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
export function vectorLayerToXmlNode(vl: VectorLayer, destinationNode: HTMLElement, xmlDoc: Document) {
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
      conditionalAttr(node, 'android:name', layer.id);
      conditionalAttr(node, 'android:pathData', layer.pathData.pathString);
      conditionalAttr(node, 'android:fillColor', layer.fillColor, '');
      conditionalAttr(node, 'android:fillAlpha', layer.fillAlpha, 1);
      conditionalAttr(node, 'android:strokeColor', layer.strokeColor, '');
      conditionalAttr(node, 'android:strokeAlpha', layer.strokeAlpha, 1);
      conditionalAttr(node, 'android:strokeWidth', layer.strokeWidth, 0);
      conditionalAttr(node, 'android:trimPathStart', layer.trimPathStart, 0);
      conditionalAttr(node, 'android:trimPathEnd', layer.trimPathEnd, 1);
      conditionalAttr(node, 'android:trimPathOffset', layer.trimPathOffset, 0);
      conditionalAttr(node, 'android:strokeLineCap', layer.strokeLinecap, 'butt');
      conditionalAttr(node, 'android:strokeLineJoin', layer.strokeLinejoin, 'miter');
      conditionalAttr(node, 'android:strokeMiterLimit', layer.strokeMiterLimit, 4);
      parentNode.appendChild(node);
      return parentNode;

    } else if (layer instanceof ClipPathLayer) {
      const node = xmlDoc.createElement('clip-path');
      conditionalAttr(node, 'android:name', layer.id);
      conditionalAttr(node, 'android:pathData', layer.pathData.pathString);
      parentNode.appendChild(node);
      return parentNode;

    } else if (layer instanceof GroupLayer) {
      const node = xmlDoc.createElement('group');
      conditionalAttr(node, 'android:name', layer.id);
      conditionalAttr(node, 'android:pivotX', layer.pivotX, 0);
      conditionalAttr(node, 'android:pivotY', layer.pivotY, 0);
      conditionalAttr(node, 'android:translateX', layer.translateX, 0);
      conditionalAttr(node, 'android:translateY', layer.translateY, 0);
      conditionalAttr(node, 'android:scaleX', layer.scaleX, 1);
      conditionalAttr(node, 'android:scaleY', layer.scaleY, 1);
      conditionalAttr(node, 'android:rotation', layer.rotation, 0);
      parentNode.appendChild(node);
      return node;
    }
  }, destinationNode);
}

function conditionalAttr(node, attr, value, skipValue?) {
  if (value !== undefined
    && value !== null
    && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(ANDROID_NS, attr, value);
  }
}

function serializeXmlNode(xmlNode) {
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
