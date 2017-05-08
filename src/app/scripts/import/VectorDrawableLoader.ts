import * as _ from 'lodash';
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

  // TODO: need to confirm we protect against duplicate ids in separate vector layers
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
      return new PathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node.getAttribute('android:name'), 'path'),
        children: [],
        // TODO: avoid crashing when pathData attribute isn't specified
        pathData: newPath(node.getAttribute('android:pathData') || ''),
        fillColor: node.getAttribute('android:fillColor') || undefined,
        fillAlpha: Number(node.getAttribute('android:fillAlpha') || 1),
        strokeColor: node.getAttribute('android:strokeColor') || undefined,
        strokeAlpha: Number(node.getAttribute('android:strokeAlpha') || 1),
        strokeWidth: Number(node.getAttribute('android:strokeWidth') || 0),
        strokeLinecap: node.getAttribute('android:strokeLineCap') || 'butt',
        strokeLinejoin: node.getAttribute('android:strokeLineJoin') || 'miter',
        strokeMiterLimit: Number(node.getAttribute('android:strokeMiterLimit') || 4),
        trimPathStart: Number(node.getAttribute('android:trimPathStart') || 0),
        trimPathEnd: Number(node.getAttribute('android:trimPathEnd') || 1),
        trimPathOffset: Number(node.getAttribute('android:trimPathOffset') || 0),
        fillType: node.getAttribute('android:fillType') || undefined,
      });
    }

    if (node.tagName === 'clip-path') {
      return new ClipPathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node.getAttribute('android:name'), 'clip-path'),
        children: [],
        // TODO: avoid crashing when pathData attribute isn't specified
        pathData: newPath(node.getAttribute('android:pathData') || ''),
      });
    }

    if (node.childNodes.length) {
      const children = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child))
        .filter(child => !!child);
      if (children && children.length) {
        return new GroupLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(node.getAttribute('android:name'), 'group'),
          children,
          pivotX: Number(node.getAttribute('android:pivotX') || 0),
          pivotY: Number(node.getAttribute('android:pivotY') || 0),
          rotation: Number(node.getAttribute('android:rotation') || 0),
          scaleX: Number(node.getAttribute('android:scaleX') || 1),
          scaleY: Number(node.getAttribute('android:scaleY') || 1),
          translateX: Number(node.getAttribute('android:translateX') || 0),
          translateY: Number(node.getAttribute('android:translateY') || 0),
        });
      }
    }

    return undefined;
  };

  const rootLayer = nodeToLayerDataFn(doc.documentElement);
  const name =
    makeFinalNodeIdFn(doc.documentElement.getAttribute('android:name'), 'vector');
  usedIds.add(name);
  const width = Number(doc.documentElement.getAttribute('android:viewportWidth'));
  const height = Number(doc.documentElement.getAttribute('android:viewportHeight'));
  const alpha = Number(doc.documentElement.getAttribute('android:alpha') || 1);
  return new VectorLayer({
    id: _.uniqueId(),
    name,
    children: rootLayer.children,
    width: Number(width || 24),
    height: Number(height || 24),
    alpha: Number(alpha || 1),
  });
}
