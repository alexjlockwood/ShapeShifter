import { INTERPOLATORS } from '../interpolators';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from '../layers';
import {
  Animation,
  AnimationBlock,
} from '../timeline';
import * as XmlSerializer from './XmlSerializer';
import * as _ from 'lodash';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';

/**
 * Serializes a VectorLayer to a vector drawable XML string.
 */
export function toVectorDrawableXmlString(artwork: VectorLayer) {
  const xmlDoc = document.implementation.createDocument(undefined, 'vector', undefined);
  const rootNode = xmlDoc.documentElement;
  artworkToXmlNode(artwork, rootNode, xmlDoc);
  return serializeXmlNode(rootNode);
}

/**
 * Serializes a given Artwork and Animation to an animatedvector drawable XML file.
 */
export function artworkAnimationToAvdXmlString(artwork: VectorLayer, animation: Animation) {
  const xmlDoc = document.implementation.createDocument(undefined, 'animated-vector', undefined);
  const rootNode = xmlDoc.documentElement;
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns:aapt', AAPT_NS);

  // Create drawable node containing the vector layer.
  const artworkContainerNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
  artworkContainerNode.setAttribute('name', 'android:drawable');
  rootNode.appendChild(artworkContainerNode);

  const artworkNode = xmlDoc.createElement('vector');
  artworkToXmlNode(artwork, artworkNode, xmlDoc);
  artworkContainerNode.appendChild(artworkNode);

  // create animation nodes (one per layer)
  const animBlocksByLayer = new Map<string, AnimationBlock[]>();
  animation.blocks.forEach(block => {
    const blocks = animBlocksByLayer.get(block.layerId) || [];
    blocks.push(block);
    animBlocksByLayer.set(block.layerId, blocks);
  });

  animBlocksByLayer.forEach((blocksForLayer, layerId) => {
    const targetNode = xmlDoc.createElement('target');
    targetNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
    rootNode.appendChild(targetNode);

    const animationNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
    animationNode.setAttribute('name', 'android:animation');
    targetNode.appendChild(animationNode);

    let blockContainerNode = animationNode;
    let multiBlock = false;
    if (blocksForLayer.length > 1) {
      multiBlock = true;

      // <set> for multiple property animations on a single layer
      blockContainerNode = xmlDoc.createElement('set');
      blockContainerNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
      animationNode.appendChild(blockContainerNode);
    }

    const layer = artwork.findLayerById(layerId);
    const animatableProperties = layer.animatableProperties;

    blocksForLayer.forEach(block => {
      const blockNode = xmlDoc.createElement('objectAnimator');
      if (!multiBlock) {
        blockNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
      }
      blockNode.setAttributeNS(ANDROID_NS, 'android:propertyName', block.propertyName);
      conditionalAttr_(blockNode, 'android:startOffset', block.startTime, 0);
      conditionalAttr_(blockNode, 'android:duration', block.endTime - block.startTime);
      conditionalAttr_(blockNode, 'android:valueFrom', block.fromValue);
      conditionalAttr_(blockNode, 'android:valueTo', block.toValue);
      conditionalAttr_(blockNode, 'android:valueType', animatableProperties[block.propertyName].animatorValueType);
      const interpolator = _.find(INTERPOLATORS, i => i.value === block.interpolator);
      conditionalAttr_(blockNode, 'android:interpolator', interpolator.androidRef);
      blockContainerNode.appendChild(blockNode);
    });
  });
  return serializeXmlNode(rootNode);
}

/**
 * Helper method that serializes an Artwork to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
function artworkToXmlNode(artwork: VectorLayer, destinationNode, xmlDoc) {
  destinationNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:width', `${artwork.width}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:height', `${artwork.height}dp`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportWidth', `${artwork.width}`);
  destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportHeight', `${artwork.height}`);
  conditionalAttr_(destinationNode, 'android:alpha', artwork.alpha, 1);

  walk(artwork, (layer, parentNode) => {
    if (layer instanceof VectorLayer) {
      return parentNode;
    } else if (layer instanceof PathLayer) {
      const node = xmlDoc.createElement('path');
      conditionalAttr_(node, 'android:name', layer.id);
      conditionalAttr_(node, 'android:pathData', layer.pathData.getPathString());
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
      conditionalAttr_(node, 'android:pathData', layer.pathData.getPathString());
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

function conditionalAttr_(node, attr, value, skipValue?) {
  if (!_.isNil(value) && (skipValue === undefined || value !== skipValue)) {
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
