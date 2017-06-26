import { ColorUtil } from 'app/scripts/common';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/scripts/model/layers';
import * as _ from 'lodash';

import * as XmlSerializer from './XmlSerializer';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Serializes an VectorLayer to a vector drawable XML file.
 */
export function toSvgString(
  vectorLayer: VectorLayer,
  width?: number,
  height?: number,
  x?: number,
  y?: number,
  withIdsAndNS = true,
  frameNumber = '',
) {
  const xmlDoc = document.implementation.createDocument(undefined, 'svg', undefined);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToSvgNode(vectorLayer, rootNode, xmlDoc, withIdsAndNS, frameNumber);
  if (width !== undefined) {
    rootNode.setAttributeNS(undefined, 'width', width.toString() + 'px');
  }
  if (height !== undefined) {
    rootNode.setAttributeNS(undefined, 'height', height.toString() + 'px');
  }
  if (x !== undefined) {
    rootNode.setAttributeNS(undefined, 'x', x.toString() + 'px');
  }
  if (y !== undefined) {
    rootNode.setAttributeNS(undefined, 'y', y.toString() + 'px');
  }
  return serializeXmlNode(rootNode);
}

/**
 * Helper method that serializes a VectorLayer to a destinationNode in an xmlDoc.
 * The destinationNode should be a <vector> node.
 */
function vectorLayerToSvgNode(
  vl: VectorLayer,
  destinationNode: HTMLElement,
  xmlDoc: Document,
  withIdsAndNS = true,
  frameNumber = '',
) {
  if (withIdsAndNS) {
    destinationNode.setAttributeNS(XMLNS_NS, 'xmlns', SVG_NS);
  }
  destinationNode.setAttributeNS(undefined, 'viewBox', `0 0 ${vl.width} ${vl.height}`);

  // TODO: would be better to have clip-paths reference other clip paths in order to reduce file size

  // Create a map where the keys are all of the clip paths in the tree, and
  // their corresponding values are any affected clipped siblings.
  const clipPathToClippedSiblingsMap = new Map<string, Set<string>>();
  (function recurseFn(layers: ReadonlyArray<Layer>) {
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer instanceof ClipPathLayer) {
        const clippedSiblings =
          layers.slice(i + 1)
            .filter(l => !(l instanceof ClipPathLayer))
            .map(l => l.id);
        if (clippedSiblings.length) {
          clipPathToClippedSiblingsMap.set(layer.id, new Set(clippedSiblings));
        }
      }
    }
    layers.forEach(l => recurseFn(l.children));
  })(vl.children);

  // Create a map where the keys are clipped siblings, and their values
  // are the list of clip paths that clipped them.
  const clippedSiblingToClipPathsMap = new Map<string, Set<string>>();
  clipPathToClippedSiblingsMap.forEach((clippedSiblingIds, clipPathId) => {
    clippedSiblingIds.forEach(clippedSiblingId => {
      const clipPathIds =
        clippedSiblingToClipPathsMap.has(clippedSiblingId)
          ? clippedSiblingToClipPathsMap.get(clippedSiblingId)
          : new Set<string>();
      clipPathIds.add(clipPathId);
      clippedSiblingToClipPathsMap.set(clippedSiblingId, clipPathIds);
    });
  });

  // Create a map of sibling IDs to the clip path name they should use when
  // referencing the clip-path.
  const clippedSiblingToClipPathReferencedIdMap = new Map<string, string>();
  clippedSiblingToClipPathsMap.forEach((clipPaths, siblingId) => {
    const siblingName = vl.findLayerById(siblingId).name;
    clippedSiblingToClipPathReferencedIdMap.set(siblingId, `clip_${siblingName}${frameNumber}`);
  });

  if (clippedSiblingToClipPathsMap.size) {
    const defsNode = xmlDoc.createElement('defs');
    clippedSiblingToClipPathsMap.forEach((clipPathIds, clippedSiblingId) => {
      const clipPathNode = xmlDoc.createElement('clipPath');
      const clipPathName = clippedSiblingToClipPathReferencedIdMap.get(clippedSiblingId);
      conditionalAttr(clipPathNode, 'id', clipPathName);
      clipPathIds.forEach(clipPathId => {
        const clipPathData = (vl.findLayerById(clipPathId) as ClipPathLayer).pathData;
        if (clipPathData && clipPathData.getPathString()) {
          const pathNode = xmlDoc.createElement('path');
          conditionalAttr(pathNode, 'd', clipPathData.getPathString());
          clipPathNode.appendChild(pathNode);
        }
      });
      defsNode.appendChild(clipPathNode);
    });
    destinationNode.appendChild(defsNode);
  }

  const shouldSetClipPathForLayerFn = (layer: Layer) => clippedSiblingToClipPathsMap.has(layer.id);

  const maybeSetClipPathForLayerFn = (layer: Layer, layerNode: HTMLElement) => {
    if (!shouldSetClipPathForLayerFn(layer)) {
      return;
    }
    const clipPathAttrValue = `url(#${clippedSiblingToClipPathReferencedIdMap.get(layer.id)})`;
    conditionalAttr(layerNode, 'clip-path', clipPathAttrValue);
  };

  walk(vl, (layer, parentNode) => {
    if (layer instanceof VectorLayer) {
      if (withIdsAndNS) {
        conditionalAttr(destinationNode, 'id', vl.name, '');
      }
      conditionalAttr(destinationNode, 'opacity', vl.alpha, 1);
      return parentNode;
    }
    if (layer instanceof PathLayer) {
      const node = xmlDoc.createElement('path');
      if (withIdsAndNS) {
        conditionalAttr(node, 'id', layer.name);
      }
      maybeSetClipPathForLayerFn(layer, node);
      const path = layer.pathData;
      conditionalAttr(node, 'd', path ? path.getPathString() : '');
      if (layer.fillColor) {
        conditionalAttr(node, 'fill', ColorUtil.androidToCssHexColor(layer.fillColor), '');
      } else {
        conditionalAttr(node, 'fill', 'none');
      }
      conditionalAttr(node, 'fill-opacity', layer.fillAlpha, 1);
      if (layer.strokeColor) {
        conditionalAttr(node, 'stroke', ColorUtil.androidToCssHexColor(layer.strokeColor), '');
      }
      conditionalAttr(node, 'stroke-opacity', layer.strokeAlpha, 1);
      conditionalAttr(node, 'stroke-width', layer.strokeWidth, 0);

      if (layer.trimPathStart !== 0
        || layer.trimPathEnd !== 1
        || layer.trimPathOffset !== 0) {
        const flattenedTransform = LayerUtil.getFlattenedTransformForLayer(vl, layer.id);
        const { a, d } = flattenedTransform;
        let pathLength: number;
        if (a !== 1 || d !== 1) {
          // Then recompute the scaled path length.
          pathLength = layer.pathData.mutate()
            .addTransforms([flattenedTransform])
            .build()
            .getPathLength();
        } else {
          pathLength = layer.pathData.getPathLength();
        }

        // Calculate the visible fraction of the trimmed path. If trimPathStart
        // is greater than trimPathEnd, then the result should be the combined
        // length of the two line segments: [trimPathStart,1] and [0,trimPathEnd].
        let shownFraction = layer.trimPathEnd - layer.trimPathStart;
        if (layer.trimPathStart > layer.trimPathEnd) {
          shownFraction += 1;
        }
        // Calculate the dash array. The first array element is the length of
        // the trimmed path and the second element is the gap, which is the
        // difference in length between the total path length and the visible
        // trimmed path length.
        const strokeDashArray =
          `${shownFraction * pathLength},${(1 - shownFraction + 0.001) * pathLength}`;
        // The amount to offset the path is equal to the trimPathStart plus
        // trimPathOffset. We mod the result because the trimmed path
        // should wrap around once it reaches 1.
        const strokeDashOffset =
          `${pathLength * (1 - ((layer.trimPathStart + layer.trimPathOffset) % 1))}`;

        conditionalAttr(node, 'stroke-dasharray', strokeDashArray);
        conditionalAttr(node, 'stroke-dashoffset', strokeDashOffset);
      }

      conditionalAttr(node, 'stroke-linecap', layer.strokeLinecap, 'butt');
      conditionalAttr(node, 'stroke-linejoin', layer.strokeLinejoin, 'miter');
      conditionalAttr(node, 'stroke-miterlimit', layer.strokeMiterLimit, 4);
      const fillRule =
        !layer.fillType || layer.fillType === 'nonZero' ? 'nonzero' : 'evenodd';
      conditionalAttr(node, 'fill-rule', fillRule, 'nonzero');
      parentNode.appendChild(node);
      return parentNode;
    }
    if (layer instanceof GroupLayer) {
      // TODO: create one node per group property being animated
      const node = xmlDoc.createElement('g');
      if (withIdsAndNS) {
        conditionalAttr(node, 'id', layer.name);
      }
      const transformValues: string[] = [];
      if (layer.translateX || layer.translateY) {
        transformValues.push(`translate(${layer.translateX} ${layer.translateY})`);
      }
      if (layer.rotation) {
        transformValues.push(`rotate(${layer.rotation} ${layer.pivotX} ${layer.pivotY})`);
      }
      if (layer.scaleX !== 1 || layer.scaleY !== 1) {
        if (layer.pivotX || layer.pivotY) {
          transformValues.push(`translate(${layer.pivotX} ${layer.pivotY})`);
        }
        transformValues.push(`scale(${layer.scaleX} ${layer.scaleY})`);
        if (layer.pivotX || layer.pivotY) {
          transformValues.push(`translate(${-layer.pivotX} ${-layer.pivotY})`);
        }
      }
      let nodeToAttachToParent = node;
      if (transformValues.length) {
        node.setAttributeNS(undefined, 'transform', transformValues.join(' '));
        if (shouldSetClipPathForLayerFn(layer)) {
          // Create a wrapper node so that the clip-path is applied before the transformations.
          const wrapperNode = xmlDoc.createElement('g');
          wrapperNode.appendChild(node);
          nodeToAttachToParent = wrapperNode;
        }
      }
      maybeSetClipPathForLayerFn(layer, nodeToAttachToParent);
      parentNode.appendChild(nodeToAttachToParent);
      return node;
    }
  }, destinationNode);
}

function conditionalAttr(node: HTMLElement, attr, value, skipValue?) {
  if (!_.isNil(value) && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(undefined, attr, value);
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
