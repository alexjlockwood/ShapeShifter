import { VectorLayer, PathLayer, GroupLayer, ClipPathLayer } from '../layers';
import * as ModelUtil from './ModelUtil';
import { ROTATION_GROUP_LAYER_ID } from '.';

export function loadArtworkFromXmlString(
  xmlString: string,
  existingLayerIds: ReadonlyArray<string>): VectorLayer {

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const usedIds = new Set<string>(existingLayerIds);
  // TODO: how should we protect against duplicate ids in separate vector layers?
  usedIds.add(ROTATION_GROUP_LAYER_ID);

  const sanitizeIdFn = (value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  };

  const makeFinalNodeIdFn = (node, typeIdPrefix: string) => {
    const finalId = ModelUtil.getUniqueId(
      sanitizeIdFn(node.id || typeIdPrefix),
      id => usedIds.has(id),
    );
    usedIds.add(finalId);
    return finalId;
  };

  const nodeToLayerDataFn = (node, context): GroupLayer | ClipPathLayer | PathLayer => {
    if (!node) {
      return undefined;
    }
    if (node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE) {
      return undefined;
    }

    let layerData = {};

    if (node.tagName === 'path') {
      return new PathLayer(layerData, {
        id: makeFinalNodeIdFn(node, 'path'),
        pathData: node.getAttribute('android:pathData') || undefined,
        fillColor: node.getAttribute('android:fillColor') || undefined,
        fillAlpha: node.getAttribute('android:fillAlpha') || 1,
        strokeColor: node.getAttribute('android:strokeColor') || undefined,
        strokeAlpha: node.getAttribute('android:strokeAlpha') || 1,
        strokeWidth: node.getAttribute('android:strokeWidth') || 0,
        strokeLinecap: node.getAttribute('android:strokeLineCap') || 'butt',
        strokeLinejoin: node.getAttribute('android:strokeLineJoin') || ,
        strokeMiterLimit: node.getAttribute('android:strokeMiterLimit') || 4,
        trimPathStart: node.getAttribute('android:trimPathStart') || 0,
        trimPathEnd: node.getAttribute('android:trimPathEnd') || 1,
        trimPathOffset: node.getAttribute('android:trimPathOffset') || 0,
      });
    }

    if (node.childNodes.length) {
      const layers =
        Array.from(node.childNodes)
          .map(child => nodeToLayerDataFn(child))
          .filter(layer => !!layer);
      if (layers && layers.length) {
        return Object.assign(layerData, {
          id: makeFinalNodeIdFn(node, 'group'),
          type: 'group',
          rotation: node.getAttribute('android:rotation') || 0,
          scaleX: node.getAttribute('android:scaleX') || 1,
          scaleY: node.getAttribute('android:scaleY') || 1,
          pivotX: node.getAttribute('android:pivotX') || 0,
          pivotY: node.getAttribute('android:pivotY') || 0,
          translateX: node.getAttribute('android:translateX') || 0,
          translateY: node.getAttribute('android:translateY') || 0,
          layers,
        });
      } else {
        return null;
      }
    }
  };

  let rootLayer = nodeToLayerDataFn(doc.documentElement);
  let id = makeFinalNodeIdFn(doc.documentElement.getAttribute('android:name') || 'vector');
  usedIds[id] = true;
  let width = doc.documentElement.getAttribute('android:viewportWidth');
  let height = doc.documentElement.getAttribute('android:viewportHeight');
  let alpha = doc.documentElement.getAttribute('android:alpha') || 1;
  let artwork = {
    id,
    width,
    height,
    layers: (rootLayer ? rootLayer.layers : null) || [],
    alpha,
  };
  return new Artwork(artwork);
}
