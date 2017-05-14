import * as _ from 'lodash';
import * as ModelUtil from './ModelUtil';
import {
  VectorLayer, GroupLayer, PathLayer,
  Layer, StrokeLineCap, StrokeLineJoin, FillType,
} from '../layers';
import { newPath, Command } from '../paths';
import { ColorUtil, Matrix } from '../common';
import { Svgo } from '../svgo';
import { ROTATION_GROUP_LAYER_ID } from '.';

/**
 * Utility function that takes an SVG string as input and
 * returns a VectorLayer model object.
 */
export function loadVectorLayerFromSvgStringWithCallback(
  svgString: string,
  callback: (vl: VectorLayer) => void,
  existingLayerIds: ReadonlyArray<string>) {

  Svgo.optimize(svgString, (optimizedSvgString: string) => {
    if (!optimizedSvgString) {
      callback(undefined);
      return;
    }
    try {
      callback(loadVectorLayerFromSvgString(optimizedSvgString, existingLayerIds));
    } catch (e) {
      console.error('Shape Shifter failed to parse the optimized SVG string', optimizedSvgString, e);
      callback(undefined);
    }
  });
}

export function loadVectorLayerFromSvgString(
  svgString: string,
  existingLayerIds: ReadonlyArray<string>): VectorLayer {

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

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

  const makeFinalNodeIdFn = (node, typeIdPrefix: string) => {
    const finalId = ModelUtil.getUniqueId(
      sanitizeIdFn(node.id || typeIdPrefix),
      id => usedIds.has(id),
    );
    usedIds.add(finalId);
    return finalId;
  };

  const lengthPxFn = svgLength => {
    if (svgLength.baseVal) {
      svgLength = svgLength.baseVal;
    }
    svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
    return svgLength.valueInSpecifiedUnits;
  };

  const nodeToLayerDataFn = (node, context): Layer => {
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
          _.chain(pathData.getSubPaths())
            .flatMap(subPath => subPath.getCommands() as Command[])
            .map(command => command.mutate().transform(transforms).build())
            .value());
      }

      // Set the default values as specified by the SVG spec. Note that some of these default
      // values are different than the default values used by VectorDrawables.
      const fillColor =
        ('fillColor' in context) ? ColorUtil.svgToAndroidColor(context.fillColor) : '#000';
      const strokeColor =
        ('strokeColor' in context) ? ColorUtil.svgToAndroidColor(context.strokeColor) : undefined;
      const fillAlpha = ('fillAlpha' in context) ? Number(context.fillAlpha) : 1;
      const strokeWidth = ('strokeWidth' in context) ? Number(context.strokeWidth) : 1;
      const strokeAlpha = ('strokeAlpha' in context) ? Number(context.strokeAlpha) : 1;
      const strokeLinecap: StrokeLineCap = ('strokeLinecap' in context) ? context.strokeLinecap : 'butt';
      const strokeLinejoin: StrokeLineJoin = ('strokeLinejoin' in context) ? context.strokeLinecap : 'miter';
      const strokeMiterLimit = ('strokeMiterLimit' in context) ? Number(context.strokeMiterLimit) : 4;
      const fillRuleToFillTypeFn = (fillRule: string) => {
        return fillRule === 'evenodd' ? 'evenOdd' : 'nonZero';
      };
      const fillType: FillType = ('fillType' in context) ? fillRuleToFillTypeFn(context.fillType) : 'nonZero';
      return new PathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node, 'path'),
        children: [],
        pathData,
        fillColor,
        fillAlpha,
        strokeColor,
        strokeAlpha,
        strokeWidth,
        strokeLinecap,
        strokeLinejoin,
        strokeMiterLimit,
        fillType,
      });
    }

    if (node.childNodes.length) {
      const children = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child, Object.assign({}, context)))
        .filter(child => !!child);
      if (children && children.length) {
        return new GroupLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(node, 'group'),
          children,
        });
      }
    }

    return undefined;
  };

  const docElContext: any = {};
  const documentElement: any = doc.documentElement;
  let width = lengthPxFn(documentElement.width) || undefined;
  let height = lengthPxFn(documentElement.height) || undefined;

  if (documentElement.viewBox
    && (!!documentElement.viewBox.baseVal.width
      || !!documentElement.viewBox.baseVal.height)) {
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
          f: -documentElement.viewBox.baseVal.y,
        },
      },
    ];
  }

  const rootLayer = nodeToLayerDataFn(documentElement, docElContext);
  const name = makeFinalNodeIdFn(documentElement, 'vector');
  const children = rootLayer ? rootLayer.children : undefined;
  const alpha = documentElement.getAttribute('opacity') || undefined;
  return new VectorLayer({
    id: _.uniqueId(),
    name,
    children,
    width: width === undefined ? undefined : Number(width),
    height: height === undefined ? undefined : Number(height),
    alpha: alpha === undefined ? undefined : Number(alpha),
  });
}
