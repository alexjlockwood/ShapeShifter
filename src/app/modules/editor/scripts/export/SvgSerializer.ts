import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { ColorUtil } from 'app/modules/editor/scripts/common';
import * as _ from 'lodash';

import * as XmlSerializer from './XmlSerializer';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Serializes an VectorLayer to a SVG string.
 */
export function toSvgString(vl: VectorLayer, width?: number, height?: number) {
  const xmlDoc = document.implementation.createDocument(undefined, 'svg', undefined);
  const rootNode = xmlDoc.documentElement;
  rootNode.setAttributeNS(XMLNS_NS, 'xmlns', SVG_NS);
  rootNode.setAttributeNS(undefined, 'viewBox', `0 0 ${vl.width} ${vl.height}`);
  vectorLayerToSvgNode(vl, rootNode, xmlDoc);
  if (width !== undefined) {
    rootNode.setAttributeNS(undefined, 'width', width.toString() + 'px');
  }
  if (height !== undefined) {
    rootNode.setAttributeNS(undefined, 'height', height.toString() + 'px');
  }
  return serializeXmlNode(rootNode);
}

export function toSvgSpriteFrameString(
  vectorLayer: VectorLayer,
  translateX = 0,
  translateY = 0,
  frameNumber = '',
) {
  const xmlDoc = document.implementation.createDocument(undefined, 'g', undefined);
  const rootNode = xmlDoc.documentElement;
  vectorLayerToSvgNode(vectorLayer, rootNode, xmlDoc, false, frameNumber);
  rootNode.setAttributeNS(undefined, 'transform', `translate(${translateX}, ${translateY})`);
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
  withIds = true,
  frameNumber = '',
) {
  // Create a map where the keys are ClipPathLayer IDs and the values
  // are their associated path data strings.
  const clipPathToPathDataMap = new Map<string, string>();
  // Create a map where the keys are non-ClipPathLayer IDs and the values are
  // the in-order list of ClipPathLayers that are clipping the layer (nearest
  // ClipPathLayer appears in the list last).
  const clippedLayerToSeenClipPathsMap = new Map<string, ReadonlyArray<string>>();
  (function recurseFn(layer: Layer) {
    interface Entry {
      readonly layer: Layer;
      readonly seenClipPaths: ReadonlyArray<ClipPathLayer>;
    }
    layer.children
      .reduce(
        (acc: ReadonlyArray<Entry>, curr) => {
          const seenClipPaths = acc.length ? [..._.last(acc).seenClipPaths] : [];
          // Ignore clip paths with empty path data strings.
          if (curr instanceof ClipPathLayer && curr.pathData && curr.pathData.getPathString()) {
            clipPathToPathDataMap.set(curr.id, curr.pathData.getPathString());
            seenClipPaths.push(curr);
          }
          return [...acc, { layer: curr, seenClipPaths }];
        },
        [] as ReadonlyArray<Entry>,
      )
      .filter(({ layer: l, seenClipPaths }) => {
        // Keep the entry if the key isn't a ClipPathLayer and its
        // associated list of seen clip paths isn't empty.
        return !(l instanceof ClipPathLayer) && seenClipPaths.length > 0;
      })
      .map(({ layer: l, seenClipPaths }) => {
        return { layerId: l.id, seenClipPaths: seenClipPaths.map(({ id }) => id) };
      })
      .forEach(({ layerId, seenClipPaths }) => {
        clippedLayerToSeenClipPathsMap.set(layerId, seenClipPaths);
      });
    layer.children.forEach(recurseFn);
  })(vl);

  // Create a map where the keys are non-ClipPathLayer IDs and the values are the
  // clip path names they should use when referencing the clip-path.
  const clippedLayerToClipPathNameMap = new Map<string, string>();
  clippedLayerToSeenClipPathsMap.forEach((seenClipPaths, layerId) => {
    const frameInfo = frameNumber ? `_frame${frameNumber}` : '';
    const layerInfo = `_${vl.findLayerById(layerId).name}`;
    const clipPathName = `clip${frameInfo}${layerInfo}`;
    clippedLayerToClipPathNameMap.set(layerId, clipPathName);
  });

  const shouldCreateDefs = clippedLayerToSeenClipPathsMap.size > 0;
  if (shouldCreateDefs) {
    const defsNode = xmlDoc.createElement('defs');
    clippedLayerToSeenClipPathsMap.forEach((seenClipPaths, layerId) => {
      const clipPathName = clippedLayerToClipPathNameMap.get(layerId);
      seenClipPaths.forEach((id, i) => {
        const clipPathNode = xmlDoc.createElement('clipPath');
        conditionalAttr(clipPathNode, 'id', clipPathName + (i ? '_' + i : ''));
        const pathNode = xmlDoc.createElement('path');
        conditionalAttr(pathNode, 'd', clipPathToPathDataMap.get(id));
        if (i + 1 < seenClipPaths.length) {
          // Build the intersection of all seen clip paths.
          const nextClipPathName = clipPathName + '_' + (i + 1);
          conditionalAttr(pathNode, 'clip-path', `url(#${nextClipPathName})`);
        }
        clipPathNode.appendChild(pathNode);
        defsNode.appendChild(clipPathNode);
      });
    });
    destinationNode.appendChild(defsNode);
  }

  const isLayerBeingClippedFn = (layerId: string) => clippedLayerToClipPathNameMap.has(layerId);
  const maybeSetClipPathForLayerFn = (node: HTMLElement, layerId: string) => {
    if (isLayerBeingClippedFn(layerId)) {
      conditionalAttr(node, 'clip-path', `url(#${clippedLayerToClipPathNameMap.get(layerId)})`);
    }
  };

  walk(
    vl,
    (layer: VectorLayer | GroupLayer | PathLayer, parentNode: Node) => {
      if (layer instanceof VectorLayer) {
        if (withIds) {
          conditionalAttr(destinationNode, 'id', vl.name, '');
        }
        conditionalAttr(destinationNode, 'opacity', vl.alpha, 1);
        return parentNode;
      }
      if (layer instanceof PathLayer) {
        const { pathData } = layer;
        if (!pathData || !pathData.getPathString()) {
          return undefined;
        }
        const node = xmlDoc.createElement('path');
        if (withIds) {
          conditionalAttr(node, 'id', layer.name);
        }
        maybeSetClipPathForLayerFn(node, layer.id);
        conditionalAttr(node, 'd', pathData.getPathString());
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

        if (layer.trimPathStart !== 0 || layer.trimPathEnd !== 1 || layer.trimPathOffset !== 0) {
          const flattenedTransform = LayerUtil.getCanvasTransformForLayer(vl, layer.id);
          const { a, d } = flattenedTransform;
          // Note that we only return the length of the first sub path due to
          // https://code.google.com/p/android/issues/detail?id=172547
          let pathLength: number;
          if (Math.abs(a) !== 1 || Math.abs(d) !== 1) {
            // Then recompute the scaled path length.
            pathLength = pathData
              .mutate()
              .transform(flattenedTransform)
              .build()
              .getSubPathLength(0);
          } else {
            pathLength = pathData.getSubPathLength(0);
          }
          const strokeDashArray = LayerUtil.toStrokeDashArray(
            layer.trimPathStart,
            layer.trimPathEnd,
            layer.trimPathOffset,
            pathLength,
          ).join(',');
          const strokeDashOffset = LayerUtil.toStrokeDashOffset(
            layer.trimPathStart,
            layer.trimPathEnd,
            layer.trimPathOffset,
            pathLength,
          ).toString();
          conditionalAttr(node, 'stroke-dasharray', strokeDashArray);
          conditionalAttr(node, 'stroke-dashoffset', strokeDashOffset);
        }

        conditionalAttr(node, 'stroke-linecap', layer.strokeLinecap, 'butt');
        conditionalAttr(node, 'stroke-linejoin', layer.strokeLinejoin, 'miter');
        conditionalAttr(node, 'stroke-miterlimit', layer.strokeMiterLimit, 4);
        const fillRule = !layer.fillType || layer.fillType === 'nonZero' ? 'nonzero' : 'evenodd';
        conditionalAttr(node, 'fill-rule', fillRule, 'nonzero');
        parentNode.appendChild(node);
        return parentNode;
      }
      if (layer instanceof GroupLayer) {
        const node = xmlDoc.createElement('g');
        if (withIds) {
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
          if (isLayerBeingClippedFn(layer.id)) {
            // Create a wrapper node so that the clip-path is applied before the transformations.
            const wrapperNode = xmlDoc.createElement('g');
            wrapperNode.appendChild(node);
            nodeToAttachToParent = wrapperNode;
          }
        }
        maybeSetClipPathForLayerFn(nodeToAttachToParent, layer.id);
        parentNode.appendChild(nodeToAttachToParent);
        return node;
      }
      return undefined;
    },
    destinationNode,
  );
}

function conditionalAttr(
  node: HTMLElement,
  attr: string,
  value: string | number,
  skipValue?: string | number,
) {
  if (!_.isNil(value) && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(undefined, attr, value.toString());
  }
}

function serializeXmlNode(xmlNode: HTMLElement) {
  return XmlSerializer.serializeToString(xmlNode, { indent: 4, multiAttributeIndent: 4 });
}

function walk(layer: VectorLayer, fn: (layer: Layer, ctx: Node) => Node, context: Node) {
  const visitFn = (l: Layer, ctx: Node) => {
    const childCtx = fn(l, ctx);
    if (l.children) {
      l.children.forEach(child => visitFn(child, childCtx));
    }
  };
  visitFn(layer, context);
}
