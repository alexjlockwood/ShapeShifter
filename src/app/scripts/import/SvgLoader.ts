import * as _ from 'lodash';
import { VectorLayer, GroupLayer, PathLayer, ClipPathLayer } from '../layers';
import { newPath, SubPath, Command } from '../paths';
import { ColorUtil, Matrix } from '../common';
import { Svgo } from '../svgo';

// This ID is reserved for the active path layer's parent group layer
// (i.e. if the user adds a rotation to the path morphing animation).
export const ROTATION_GROUP_LAYER_ID = 'rotation_group';

/**
 * Utility function that takes an SVG string as input and
 * returns a VectorLayer model object.
 */
export function loadVectorLayerFromSvgStringWithCallback(
  svgString: string,
  callback: (vl: VectorLayer) => void) {

  Svgo.optimize(svgString, (optimizedSvgString: string) => {
    callback(loadVectorLayerFromSvgString(optimizedSvgString));
  });
}

export function loadVectorLayerFromSvgString(svgString: string): VectorLayer {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  const sanitizeIdFn = (value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  };

  const usedIds = {
    ROTATION_GROUP_LAYER_ID: true,
  };

  const makeFinalNodeIdFn = (node, typeIdPrefix: string) => {
    const finalId = getUniqueId(
      sanitizeIdFn(node.id || typeIdPrefix),
      id => usedIds[id],
    );
    usedIds[finalId] = true;
    return finalId;
  };

  const lengthPxFn = svgLength => {
    if (svgLength.baseVal) {
      svgLength = svgLength.baseVal;
    }
    svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
    return svgLength.valueInSpecifiedUnits;
  };

  const nodeToLayerDataFn = (node, context): GroupLayer | ClipPathLayer | PathLayer => {
    if (!node) {
      return undefined;
    }

    if (node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE
      || node instanceof SVGDefsElement
      || node instanceof SVGUseElement) {
      return undefined;
    }

    const simpleAttrFn = (nodeAttr, contextAttr) => {
      if (node.attributes && node.attributes[nodeAttr]) {
        context[contextAttr] = node.attributes[nodeAttr].value;
      }
    };

    simpleAttrFn('stroke', 'strokeColor');
    simpleAttrFn('stroke-width', 'strokeWidth');
    simpleAttrFn('stroke-linecap', 'strokeLinecap');
    simpleAttrFn('stroke-linejoin', 'strokeLinejoin');
    simpleAttrFn('stroke-miterlimit', 'strokeMiterLimit');
    simpleAttrFn('stroke-opacity', 'strokeAlpha');
    simpleAttrFn('fill', 'fillColor');
    simpleAttrFn('fill-opacity', 'fillAlpha');
    simpleAttrFn('fill-rule', 'fillType');

    if (node.transform) {
      const transforms = Array.from(node.transform.baseVal).reverse();
      context.transforms = context.transforms ? context.transforms.slice() : [];
      context.transforms.splice(0, 0, ...transforms);
    }

    let path;
    if (node instanceof SVGPathElement) {
      path = node.attributes ? (node.attributes as any).d.value : '';
    }

    if (path) {
      let pathData = newPath(path);
      if (context.transforms && context.transforms.length) {
        const transforms = context.transforms.map(t => t.matrix as Matrix);
        pathData = newPath(
          _.chain(pathData.getSubPaths() as SubPath[])
            .flatMap(subPath => subPath.getCommands() as Command[])
            .map(command => command.mutate().transform(transforms).build())
            .value());
      }

      const fillColor =
        ('fillColor' in context) ? ColorUtil.svgToAndroidColor(context.fillColor) : '#ff000000';
      const strokeColor =
        ('strokeColor' in context) ? ColorUtil.svgToAndroidColor(context.strokeColor) : undefined;
      const fillAlpha = ('fillAlpha' in context) ? context.fillAlpha : 1;
      const strokeWidth = ('strokeWidth' in context) ? context.strokeWidth : 1;
      const strokeAlpha = ('strokeAlpha' in context) ? context.strokeAlpha : 1;
      const strokeMiterLimit = ('strokeMiterLimit' in context) ? context.strokeMiterLimit : 4;
      const fillRuleToFillTypeFn = (fillRule: string) => {
        return fillRule === 'evenodd' ? 'evenOdd' : 'nonZero';
      };
      const fillType = ('fillType' in context) ? fillRuleToFillTypeFn(context.fillType) : 'nonZero';
      return new PathLayer(
        makeFinalNodeIdFn(node, 'path'),
        pathData,
        fillColor,
        Number(fillAlpha),
        strokeColor,
        Number(strokeAlpha),
        Number(strokeWidth),
        context.strokeLinecap || 'butt',
        context.strokeLinejoin || 'miter',
        Number(strokeMiterLimit),
        fillType,
      );
    }

    if (node.childNodes.length) {
      const layers = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child, Object.assign({}, context)))
        .filter(layer => !!layer);
      if (layers && layers.length) {
        return new GroupLayer(
          layers,
          makeFinalNodeIdFn(node, 'group'),
        );
      }
    }

    return undefined;
  };

  const docElContext: any = {};
  const documentElement: any = doc.documentElement;
  let width = lengthPxFn(documentElement.width);
  let height = lengthPxFn(documentElement.height);

  if (documentElement.viewBox) {
    width = documentElement.viewBox.baseVal.width;
    height = documentElement.viewBox.baseVal.height;

    // Fake a translate transform for the viewbox.
    docElContext.transforms = [
      {
        matrix: {
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          e: -documentElement.viewBox.baseVal.x,
          f: -documentElement.viewBox.baseVal.y
        }
      }
    ];
  }

  const rootLayer = nodeToLayerDataFn(documentElement, docElContext);
  const id = makeFinalNodeIdFn(documentElement, 'vector');
  const childrenLayers = rootLayer ? rootLayer.children : undefined;
  const alpha = documentElement.getAttribute('opacity') || undefined;

  return new VectorLayer(
    childrenLayers,
    id,
    Number(width || 24),
    Number(height || 24),
    Number(alpha || 1));
}

function getUniqueId(prefix = '', objectById = (_) => undefined, targetObject?) {
  let n = 0;
  const idFn = () => prefix + (n ? `_${n}` : '');
  while (true) {
    const o = objectById(idFn());
    if (!o || o === targetObject) {
      break;
    }
    n++;
  }
  return idFn();
}
