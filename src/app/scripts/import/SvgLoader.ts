import {
  ColorUtil,
  Matrix,
} from 'app/scripts/common';
import {
  ClipPathLayer,
  FillType,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  StrokeLineCap,
  StrokeLineJoin,
  VectorLayer,
} from 'app/scripts/model/layers';
import {
  Command,
  Path,
} from 'app/scripts/model/paths';
import { NameProperty } from 'app/scripts/model/properties';
import { Svgo } from 'app/scripts/svgo';
import * as _ from 'lodash';

// TODO: trim ids/strings?
// TODO: check for invalid enum values

/**
 * Utility function that takes an SVG string as input and
 * returns a VectorLayer model object.
 */
export function loadVectorLayerFromSvgStringWithCallback(
  svgString: string,
  callbackFn: (vl: VectorLayer) => void,
  doesNameExistFn: (name: string) => boolean,
) {
  Svgo.optimize(svgString, (optimizedSvgString: string) => {
    if (!optimizedSvgString) {
      callbackFn(undefined);
      return;
    }
    try {
      callbackFn(loadVectorLayerFromSvgString(optimizedSvgString, doesNameExistFn));
    } catch (e) {
      console.error('Failed to parse the optimized SVG file', e);
      callbackFn(undefined);
      throw e;
    }
  });
}

export function loadVectorLayerFromSvgString(
  svgString: string,
  doesNameExistFn: (name: string) => boolean,
): VectorLayer {
  const usedIds = new Set<string>();
  const makeFinalNodeIdFn = (node, prefix: string) => {
    const finalName = LayerUtil.getUniqueName(
      NameProperty.sanitize(node.id || prefix),
      name => doesNameExistFn(name) || usedIds.has(name),
    );
    usedIds.add(finalName);
    return finalName;
  };

  const parser = new DOMParser();
  const { documentElement } = parser.parseFromString(svgString, 'image/svg+xml');
  if (!isSvgNode(documentElement)) {
    return undefined;
  }

  const toNumberFn = num => num === undefined ? undefined : Number(num);
  let width = toNumberFn(svgLengthToPx(documentElement.width) || undefined);
  let height = toNumberFn(svgLengthToPx(documentElement.height) || undefined);
  const alpha = toNumberFn(documentElement.getAttribute('opacity') || undefined);

  const rootTransforms: Matrix[] = [];
  const { viewBox } = documentElement;
  if (viewBox && (!!viewBox.baseVal.width || !!viewBox.baseVal.height)) {
    width = viewBox.baseVal.width;
    height = viewBox.baseVal.height;

    // Fake a translate transform for the viewbox.
    rootTransforms.push(Matrix.fromTranslation(-viewBox.baseVal.x, -viewBox.baseVal.y));
  }

  // TODO: handle clip paths referencing other clip paths
  const clipPathMap: { [index: string]: ReadonlyArray<Path> } = {};

  const nodeToLayerDataFn = (node: Element, transforms: ReadonlyArray<Matrix>): Layer => {
    if (!node
      || node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE
      || node instanceof SVGDefsElement
      || node instanceof SVGUseElement) {
      return undefined;
    }

    const attrMap: { [index: string]: any } = {};
    const simpleAttrFn = (nodeAttr: string, contextAttr: string) => {
      if (node.hasAttribute(nodeAttr)) {
        attrMap[contextAttr] = node.getAttribute(nodeAttr);
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

    let path = '';
    if (node instanceof SVGPathElement && node.hasAttribute('d')) {
      path = node.getAttribute('d');
    }

    const nodeTransforms = getNodeTransforms(node as SVGGraphicsElement).reverse();
    transforms = [...nodeTransforms, ...transforms];

    // Get the referenced clip-path ID, if one exists.
    const refClipPathId = getReferencedClipPathId(node);

    const wrapClipPathInGroupFn = (layer: Layer) => {
      if (refClipPathId) {
        const paths =
          (clipPathMap[refClipPathId] || [])
            .map(p => p.mutate().addTransforms(transforms).build().clone());
        if (!paths.length) {
          // If the clipPath has no children, then mask the entire vector layer.
          paths.push(new Path(`M 0 0 h ${width} v ${height} h ${-width} v ${-height}`));
        }
        const groupChildren: Layer[] =
          paths.map(p => {
            return new ClipPathLayer({
              name: makeFinalNodeIdFn(refClipPathId, 'mask'),
              pathData: p,
              children: [],
            });
          });
        groupChildren.push(layer);
        return new GroupLayer({
          name: makeFinalNodeIdFn('group', 'group'),
          children: groupChildren,
        });
      }
      return layer;
    };

    if (path) {
      // Set the default values as specified by the SVG spec. Note that some of these default
      // values are different than the default values used by VectorDrawables.
      const fillColor =
        ('fillColor' in attrMap) ? ColorUtil.svgToAndroidColor(attrMap['fillColor']) : '#000';
      const strokeColor =
        ('strokeColor' in attrMap) ? ColorUtil.svgToAndroidColor(attrMap['strokeColor']) : undefined;
      const fillAlpha = ('fillAlpha' in attrMap) ? Number(attrMap['fillAlpha']) : 1;
      let strokeWidth = ('strokeWidth' in attrMap) ? Number(attrMap['strokeWidth']) : 1;
      const strokeAlpha = ('strokeAlpha' in attrMap) ? Number(attrMap['strokeAlpha']) : 1;
      const strokeLinecap: StrokeLineCap = ('strokeLinecap' in attrMap) ? attrMap['strokeLinecap'] : 'butt';
      const strokeLinejoin: StrokeLineJoin = ('strokeLinejoin' in attrMap) ? attrMap['strokeLinecap'] : 'miter';
      const strokeMiterLimit = ('strokeMiterLimit' in attrMap) ? Number(attrMap['strokeMiterLimit']) : 4;
      const fillRuleToFillTypeFn = (fillRule: string) => {
        return fillRule === 'evenodd' ? 'evenOdd' : 'nonZero';
      };
      const fillType: FillType = ('fillType' in attrMap) ? fillRuleToFillTypeFn(attrMap['fillType']) : 'nonZero';

      let pathData = new Path(path);
      if (transforms.length) {
        pathData = pathData.mutate().addTransforms(transforms).build().clone();
        const flattenedTransform = Matrix.flatten(...transforms);
        strokeWidth *= flattenedTransform.getScale();
      }

      const layer: Layer =
        new PathLayer({
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
      return wrapClipPathInGroupFn(layer);
    }

    if (node.childNodes) {
      const children: Layer[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes.item(i) as Element;
        const layer = nodeToLayerDataFn(child, transforms);
        if (layer) {
          children.push(layer);
        }
      }
      const groupLayer = new GroupLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node, 'group'),
        children,
      });
      return wrapClipPathInGroupFn(groupLayer);
    }
    return undefined;
  };

  // Find all clip path elements and add them to the map.
  (function findClipPathsFn(node: Element) {
    if (!node || node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
      return;
    }
    if (node instanceof SVGClipPathElement) {
      if (node.childNodes) {
        const paths: Path[] = [];
        const clipPathTransforms = getNodeTransforms(node).reverse();
        for (let i = 0; i < node.childNodes.length; i++) {
          const childNode = node.childNodes.item(i) as Element;
          if (childNode instanceof SVGPathElement && childNode.hasAttribute('d')) {
            const pathStr = childNode.getAttribute('d');
            if (!pathStr) {
              continue;
            }
            const matrices = getNodeTransforms(childNode).reverse();
            paths.push(
              new Path(pathStr)
                .mutate()
                .addTransforms([...matrices, ...clipPathTransforms])
                .build()
                .clone(),
            );
          }
        }
        clipPathMap[node.getAttribute('id')] = paths;
      }
      return;
    }
    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        findClipPathsFn(node.childNodes.item(i) as Element);
      }
    }
  })(documentElement);

  const rootLayer = nodeToLayerDataFn(documentElement, rootTransforms);
  const name = makeFinalNodeIdFn(documentElement, 'vector');
  const children = rootLayer ? rootLayer.children : undefined;
  return new VectorLayer({ id: _.uniqueId(), name, children, width, height, alpha });
}

function isSvgNode(node: Element): node is SVGSVGElement {
  return node.nodeName === 'svg';
}

function getNodeTransforms(node: SVGGraphicsElement) {
  if (!node.transform) {
    return [];
  }
  const transformList = node.transform.baseVal;
  const matrices: Matrix[] = [];
  for (let i = 0; i < transformList.numberOfItems; i++) {
    const t = transformList.getItem(i);
    const { a, b, c, d, e, f } = t.matrix;
    matrices.push(new Matrix(a, b, c, d, e, f));
  }
  return matrices;
}

function getReferencedClipPathId(node: Element) {
  if (!node.getAttribute('clip-path')) {
    return undefined;
  }
  const clipPathAttr = node.getAttribute('clip-path').trim();
  if (!clipPathAttr || !clipPathAttr.startsWith('url(#')) {
    return undefined;
  }
  const endParenIndex = clipPathAttr.indexOf(')');
  if (endParenIndex !== clipPathAttr.length - 1) {
    return undefined;
  }
  return clipPathAttr.slice('url(#'.length, endParenIndex);
}

function svgLengthToPx(svgLength) {
  if (svgLength.baseVal) {
    svgLength = svgLength.baseVal;
  }
  svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
  return svgLength.valueInSpecifiedUnits;
}
