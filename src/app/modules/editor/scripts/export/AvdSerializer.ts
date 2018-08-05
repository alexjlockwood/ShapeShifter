import { INTERPOLATORS } from 'app/modules/editor/model/interpolators';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import * as _ from 'lodash';

import * as XmlSerializer from './XmlSerializer';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';

/**
 * Serializes a VectorLayer to a vector drawable XML string.
 */
export function toVectorDrawableXmlString(vl: VectorLayer) {
  const xmlDoc = document.implementation.createDocument(undefined, 'vector', undefined);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToXmlNode(vl, rootNode, xmlDoc);
  return serializeXmlNode(rootNode);
}

/**
 * Serializes a given VectorLayer and Animation to an animatedvector drawable XML file.
 */
export function toAnimatedVectorDrawableXmlString(vl: VectorLayer, animation: Animation) {
  const xmlDoc = document.implementation.createDocument(undefined, 'animated-vector', undefined);
  const rootNode = xmlDoc.documentElement;
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:aapt', AAPT_NS);

  // Create drawable node containing the vector layer.
  const vectorLayerContainerNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
  vectorLayerContainerNode.setAttribute('name', 'android:drawable');
  rootNode.appendChild(vectorLayerContainerNode);

  const vectorLayerNode = xmlDoc.createElement('vector');
  vectorLayerToXmlNode(vl, vectorLayerNode, xmlDoc, false);
  vectorLayerContainerNode.appendChild(vectorLayerNode);

  // create animation nodes (one per layer)
  const animBlocksByLayer = new Map<string, AnimationBlock[]>();
  animation.blocks.forEach(block => {
    const blocks = animBlocksByLayer.get(block.layerId) || [];
    blocks.push(block);
    animBlocksByLayer.set(block.layerId, blocks);
  });

  animBlocksByLayer.forEach((blocksForLayer, layerId) => {
    const targetNode = xmlDoc.createElement('target');
    const layer = vl.findLayerById(layerId);
    targetNode.setAttributeNS(ANDROID_NS, 'android:name', layer.name);
    rootNode.appendChild(targetNode);

    const animationNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
    animationNode.setAttribute('name', 'android:animation');
    targetNode.appendChild(animationNode);

    let blockContainerNode = animationNode;
    if (blocksForLayer.length > 1) {
      // <set> for multiple property animations on a single layer.
      blockContainerNode = xmlDoc.createElement('set');
      animationNode.appendChild(blockContainerNode);
    }

    const animatableProperties = layer.animatableProperties;

    blocksForLayer.forEach(block => {
      const blockNode = xmlDoc.createElement('objectAnimator');
      blockNode.setAttributeNS(ANDROID_NS, 'android:propertyName', block.propertyName);
      conditionalAttrFn(blockNode, 'android:startOffset', block.startTime, 0);
      conditionalAttrFn(blockNode, 'android:duration', block.endTime - block.startTime);
      if (block instanceof PathAnimationBlock) {
        const fromPath = block.fromValue;
        const toPath = block.toValue;
        conditionalAttrFn(blockNode, 'android:valueFrom', fromPath ? fromPath.getPathString() : '');
        conditionalAttrFn(blockNode, 'android:valueTo', toPath ? toPath.getPathString() : '');
      } else {
        conditionalAttrFn(blockNode, 'android:valueFrom', block.fromValue);
        conditionalAttrFn(blockNode, 'android:valueTo', block.toValue);
      }
      conditionalAttrFn(
        blockNode,
        'android:valueType',
        animatableProperties.get(block.propertyName).getAnimatorValueType(),
      );
      const interpolator = _.find(INTERPOLATORS, i => i.value === block.interpolator);
      conditionalAttrFn(blockNode, 'android:interpolator', interpolator.androidRef);
      blockContainerNode.appendChild(blockNode);
    });
  });
  return serializeXmlNode(rootNode);
}

/**
 * Helper method that serializes an VectorLayer to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
function vectorLayerToXmlNode(
  vl: VectorLayer,
  destinationNode: any,
  xmlDoc: any,
  withAndroidNs = true,
) {
  if (withAndroidNs) {
    destinationNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  }
  conditionalAttrFn(destinationNode, 'android:name', vl.name);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:width', `${vl.width}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:height', `${vl.height}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportWidth', `${vl.width}`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportHeight', `${vl.height}`);
  conditionalAttrFn(destinationNode, 'android:alpha', vl.alpha, 1);

  walk(
    vl,
    (layer: any, parentNode: any) => {
      if (layer instanceof VectorLayer) {
        return parentNode;
      } else if (layer instanceof PathLayer) {
        const node = xmlDoc.createElement('path');
        const path = layer.pathData;
        conditionalAttrFn(node, 'android:name', layer.name);
        conditionalAttrFn(node, 'android:pathData', path ? path.getPathString() : '');
        conditionalAttrFn(node, 'android:fillColor', layer.fillColor, '');
        conditionalAttrFn(node, 'android:fillAlpha', layer.fillAlpha, 1);
        conditionalAttrFn(node, 'android:strokeColor', layer.strokeColor, '');
        conditionalAttrFn(node, 'android:strokeAlpha', layer.strokeAlpha, 1);
        conditionalAttrFn(node, 'android:strokeWidth', layer.strokeWidth, 0);
        conditionalAttrFn(node, 'android:trimPathStart', layer.trimPathStart, 0);
        conditionalAttrFn(node, 'android:trimPathEnd', layer.trimPathEnd, 1);
        conditionalAttrFn(node, 'android:trimPathOffset', layer.trimPathOffset, 0);
        conditionalAttrFn(node, 'android:strokeLineCap', layer.strokeLinecap, 'butt');
        conditionalAttrFn(node, 'android:strokeLineJoin', layer.strokeLinejoin, 'miter');
        conditionalAttrFn(node, 'android:strokeMiterLimit', layer.strokeMiterLimit, 4);
        conditionalAttrFn(node, 'android:fillType', layer.fillType, 'nonZero');
        parentNode.appendChild(node);
        return parentNode;
      } else if (layer instanceof ClipPathLayer) {
        const node = xmlDoc.createElement('clip-path');
        const path = layer.pathData;
        conditionalAttrFn(node, 'android:name', layer.name);
        conditionalAttrFn(node, 'android:pathData', path ? path.getPathString() : '');
        parentNode.appendChild(node);
        return parentNode;
      } else if (layer instanceof GroupLayer) {
        const node = xmlDoc.createElement('group');
        conditionalAttrFn(node, 'android:name', layer.name);
        conditionalAttrFn(node, 'android:pivotX', layer.pivotX, 0);
        conditionalAttrFn(node, 'android:pivotY', layer.pivotY, 0);
        conditionalAttrFn(node, 'android:translateX', layer.translateX, 0);
        conditionalAttrFn(node, 'android:translateY', layer.translateY, 0);
        conditionalAttrFn(node, 'android:scaleX', layer.scaleX, 1);
        conditionalAttrFn(node, 'android:scaleY', layer.scaleY, 1);
        conditionalAttrFn(node, 'android:rotation', layer.rotation, 0);
        parentNode.appendChild(node);
        return node;
      }
    },
    destinationNode,
  );
}

function conditionalAttrFn(node: any, attr: any, value: any, skipValue?: any) {
  if (!_.isNil(value) && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(ANDROID_NS, attr, value);
  }
}

function serializeXmlNode(xmlNode: any) {
  return XmlSerializer.serializeToString(xmlNode, { indent: 4, multiAttributeIndent: 4 });
}

function walk(layer: VectorLayer, fn: any, context: any) {
  const visitFn = (l: Layer, ctx: any) => {
    const childCtx = fn(l, ctx);
    if (l.children) {
      l.children.forEach(child => visitFn(child, childCtx));
    }
  };
  visitFn(layer, context);
}
