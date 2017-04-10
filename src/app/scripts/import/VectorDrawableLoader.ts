import * as ModelUtil from './ModelUtil';
import { VectorLayer, PathLayer, GroupLayer, ClipPathLayer } from '../layers';
import { newPath } from '../paths';
import { ROTATION_GROUP_LAYER_ID } from '.';

export function loadVectorLayerFromXmlString(
  xmlString: string,
  existingLayerIds: ReadonlyArray<string>): VectorLayer {

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const sanitizeIdFn = (value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  };

  // TODO: how should we protect against duplicate ids in separate vector layers?
  const usedIds = new Set<string>(existingLayerIds);
  usedIds.add(ROTATION_GROUP_LAYER_ID);

  const makeFinalNodeIdFn = (value: string, typeIdPrefix: string) => {
    const finalId = ModelUtil.getUniqueId(
      sanitizeIdFn(value || typeIdPrefix),
      id => usedIds.has(id),
    );
    usedIds.add(finalId);
    return finalId;
  };

  const nodeToLayerDataFn = (node): GroupLayer | ClipPathLayer | PathLayer => {
    if (!node) {
      return undefined;
    }
    if (node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE) {
      return undefined;
    }

    if (node.tagName === 'path') {
      return new PathLayer(
        makeFinalNodeIdFn(node.getAttribute('android:name'), 'path'),
        // TODO: avoid crashing when pathData attribute isn't specified
        newPath(node.getAttribute('android:pathData') || ''),
        node.getAttribute('android:fillColor') || undefined,
        Number(node.getAttribute('android:fillAlpha') || 1),
        node.getAttribute('android:strokeColor') || undefined,
        Number(node.getAttribute('android:strokeAlpha') || 1),
        Number(node.getAttribute('android:strokeWidth') || 0),
        node.getAttribute('android:strokeLineCap') || 'butt',
        node.getAttribute('android:strokeLineJoin') || 'miter',
        Number(node.getAttribute('android:strokeMiterLimit') || 4),
        node.getAttribute('android:fillType') || undefined,
        Number(node.getAttribute('android:trimPathStart') || 0),
        Number(node.getAttribute('android:trimPathEnd') || 1),
        Number(node.getAttribute('android:trimPathOffset') || 0),
      );
    }

    if (node.tagName === 'clip-path') {
      return new ClipPathLayer(
        makeFinalNodeIdFn(node.getAttribute('android:name'), 'clip-path'),
        // TODO: avoid crashing when pathData attribute isn't specified
        newPath(node.getAttribute('android:pathData') || ''),
      );
    }

    if (node.childNodes.length) {
      const layers = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child))
        .filter(layer => !!layer);
      if (layers && layers.length) {
        return new GroupLayer(
          layers,
          makeFinalNodeIdFn(node.getAttribute('android:name'), 'group'),
          Number(node.getAttribute('android:pivotX') || 0),
          Number(node.getAttribute('android:pivotY') || 0),
          Number(node.getAttribute('android:rotation') || 0),
          Number(node.getAttribute('android:scaleX') || 1),
          Number(node.getAttribute('android:scaleY') || 1),
          Number(node.getAttribute('android:translateX') || 0),
          Number(node.getAttribute('android:translateY') || 0),
        );
      }
    }

    return undefined;
  };

  const rootLayer = nodeToLayerDataFn(doc.documentElement);
  const id =
    makeFinalNodeIdFn(doc.documentElement.getAttribute('android:name'), 'vector');
  usedIds.add(id);
  const width = Number(doc.documentElement.getAttribute('android:viewportWidth'));
  const height = Number(doc.documentElement.getAttribute('android:viewportHeight'));
  const alpha = Number(doc.documentElement.getAttribute('android:alpha') || 1);
  return new VectorLayer(
    rootLayer.children,
    id,
    Number(width || 24),
    Number(height || 24),
    Number(alpha || 1));
}
