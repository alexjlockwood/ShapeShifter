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
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { NameProperty } from 'app/modules/editor/model/properties';
import { ColorUtil, MathUtil, Matrix } from 'app/modules/editor/scripts/common';
import { optimizeSvg } from 'app/modules/editor/scripts/svgo';
import _ from 'lodash';

// TODO: trim ids/strings?
// TODO: check for invalid enum values

// The presentation attributes that elements inherit from their ancestors.
const INHERITED_ATTRS = [
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'fill',
  'fill-opacity',
  'fill-rule',
];

/**
 * Utility function that takes an SVG string as input and
 * returns a VectorLayer model object.
 */
export function loadVectorLayerFromSvgString(
  svgString: string,
  doesNameExistFn: (name: string) => boolean,
) {
  return optimizeSvg(svgString).then(optimizedSvgString => {
    const vl = optimizedSvgString
      ? loadVectorLayerFromSvgStringInternal(optimizedSvgString, doesNameExistFn)
      : undefined;
    if (!vl) {
      throw new Error("Couldn't import the SVG");
    }
    return vl;
  });
}

// TODO: give better error message when user attempts to import SVG w/o a namespace declaration
export function loadVectorLayerFromSvgStringInternal(
  svgString: string,
  doesNameExistFn: (name: string) => boolean,
): VectorLayer | undefined {
  const usedIds = new Set<string>();
  const makeFinalNodeIdFn = (nodeId: string | null, prefix: string) => {
    const finalName = LayerUtil.getUniqueName(
      NameProperty.sanitize(nodeId || prefix),
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

  // TODO: handle clipPaths that have children path elements with clip-path attributes
  // TODO: handle clipPaths with clipPathUnits="objectBoundingBox"
  // TODO: confirm that clipPath transforms (and any referenced transforms) are handled correctly
  const clipPathMap = _.mapValues(buildPathInfosMap(documentElement), infos => {
    return infos.map(info => info.path);
  });

  const nodeToLayerFn = (
    node: Element,
    transforms: ReadonlyArray<Matrix>,
    inheritedAttrs: Readonly<Dictionary<string>> = {},
  ): Layer | undefined => {
    if (
      !node ||
      node.nodeType === Node.TEXT_NODE ||
      node.nodeType === Node.COMMENT_NODE ||
      node instanceof SVGDefsElement ||
      node instanceof SVGUseElement
    ) {
      return undefined;
    }

    // svgo only moves a group's attributes onto its children in some cases (e.g. not when the
    // group has more than one child, or when the child has an id).
    const attrs = { ...inheritedAttrs };
    for (const attr of INHERITED_ATTRS) {
      const value = node.getAttribute(attr);
      if (value !== null && value !== 'inherit') {
        attrs[attr] = value;
      }
    }

    const nodeTransforms = getNodeTransforms(node as SVGGraphicsElement);
    transforms = [...transforms, ...nodeTransforms];
    const flattenedTransforms = Matrix.flatten(transforms);

    // Get the referenced clip-path ID, if one exists.
    const refClipPathId = getReferencedClipPathId(node);

    const maybeWrapClipPathInGroupFn = (layer: Layer) => {
      if (!refClipPathId) {
        return layer;
      }
      const paths = (clipPathMap[refClipPathId] || []).map(p => {
        return new Path(
          p
            .mutate()
            .transform(flattenedTransforms)
            .build()
            .getPathString(),
        );
      });
      if (!paths.length) {
        // If the clipPath has no children, then clip the entire layer.
        paths.push(new Path('M 0 0 Z'));
      }
      const groupChildren: Layer[] = paths.map(p => {
        return new ClipPathLayer({
          name: makeFinalNodeIdFn(refClipPathId, 'mask'),
          pathData: p,
          children: [],
        });
      });
      groupChildren.push(layer);
      return new GroupLayer({
        name: makeFinalNodeIdFn('wrapper', 'group'),
        children: groupChildren,
      });
    };

    const path = node.getAttribute('d');
    if (node instanceof SVGPathElement && path) {
      const attrMap: Dictionary<any> = {};
      const simpleAttrFn = (nodeAttr: string, contextAttr: string) => {
        if (nodeAttr in attrs) {
          attrMap[contextAttr] = attrs[nodeAttr];
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

      // Set the default values as specified by the SVG spec. Note that some of these default
      // values are different than the default values used by VectorDrawables.
      const fillColor =
        'fillColor' in attrMap ? ColorUtil.svgToAndroidColor(attrMap['fillColor']) : '#000';
      const strokeColor =
        'strokeColor' in attrMap ? ColorUtil.svgToAndroidColor(attrMap['strokeColor']) : undefined;
      const fillAlpha = 'fillAlpha' in attrMap ? Number(attrMap['fillAlpha']) : 1;
      let strokeWidth = 'strokeWidth' in attrMap ? Number(attrMap['strokeWidth']) : 1;
      const strokeAlpha = 'strokeAlpha' in attrMap ? Number(attrMap['strokeAlpha']) : 1;
      const strokeLinecap: StrokeLineCap =
        'strokeLinecap' in attrMap ? attrMap['strokeLinecap'] : 'butt';
      const strokeLinejoin: StrokeLineJoin =
        'strokeLinejoin' in attrMap ? attrMap['strokeLinejoin'] : 'miter';
      const strokeMiterLimit =
        'strokeMiterLimit' in attrMap ? Number(attrMap['strokeMiterLimit']) : 4;
      const fillRuleToFillTypeFn = (fillRule: string) => {
        return fillRule === 'evenodd' ? 'evenOdd' : 'nonZero';
      };
      const fillType: FillType =
        'fillType' in attrMap ? fillRuleToFillTypeFn(attrMap['fillType']) : 'nonZero';

      let pathData = parsePath(path, !!strokeColor && strokeLinecap !== 'butt');
      if (transforms.length) {
        pathData = new Path(
          pathData
            .mutate()
            .transform(flattenedTransforms)
            .build()
            .getPathString(),
        );
        strokeWidth = MathUtil.round(strokeWidth * flattenedTransforms.getScaleFactor());
      }
      // TODO: make best effort attempt to restore trimPath{Start,End,Offset}
      return maybeWrapClipPathInGroupFn(
        new PathLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(node.getAttribute('id'), 'path'),
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
        }),
      );
    }

    // TODO: we should *not* iterate over a clip path's children here...
    if (node.childNodes) {
      const children: Layer[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes.item(i) as Element;
        const layer = nodeToLayerFn(child, transforms, attrs);
        if (layer) {
          children.push(layer);
        }
      }
      return maybeWrapClipPathInGroupFn(
        new GroupLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(node.getAttribute('id'), 'group'),
          children,
        }),
      );
    }
    return undefined;
  };

  const toNumberFn = (num: any) => (num === undefined ? undefined : Number(num));
  let width = toNumberFn(svgLengthToPx(documentElement.width) || undefined);
  let height = toNumberFn(svgLengthToPx(documentElement.height) || undefined);
  const alpha = toNumberFn(documentElement.getAttribute('opacity') || undefined);

  const rootTransforms: Matrix[] = [];
  const { viewBox } = documentElement;
  if (viewBox && (!!viewBox.baseVal.width || !!viewBox.baseVal.height)) {
    width = viewBox.baseVal.width;
    height = viewBox.baseVal.height;

    // Fake a translate transform for the viewbox.
    rootTransforms.push(Matrix.translation(-viewBox.baseVal.x, -viewBox.baseVal.y));
  }
  const rootLayer = nodeToLayerFn(documentElement, rootTransforms);
  return new VectorLayer({
    id: _.uniqueId(),
    name: makeFinalNodeIdFn(documentElement.getAttribute('id'), 'vector'),
    children: rootLayer ? rootLayer.children : [],
    width,
    height,
    alpha,
  });
}

function svgLengthToPx(svgLength: any) {
  if (!svgLength) {
    return 0;
  }
  if (svgLength.baseVal) {
    svgLength = svgLength.baseVal;
  }
  svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
  return svgLength.valueInSpecifiedUnits;
}

function isSvgNode(node: Element): node is SVGSVGElement {
  return node.nodeName === 'svg';
}

/**
 * Parses a path, dropping any zero-length segments. svgo 1.x removed these for us, but svgo 4
 * ties that option to also dropping closepath commands, which would leave closed subpaths open.
 * Zero-length segments are kept when a round or square line cap would draw them as dots.
 */
function parsePath(pathStr: string, isDrawnAsDot = false) {
  const path = new Path(pathStr);
  if (isDrawnAsDot) {
    return path;
  }
  const cmds = path.getCommands();
  const nonZeroLengthCmds = cmds.filter(cmd => {
    const { start } = cmd;
    if (cmd.type === 'M' || cmd.type === 'Z' || !start) {
      return true;
    }
    return cmd.points.some(p => !!p && !MathUtil.arePointsEqual(p, start));
  });
  return nonZeroLengthCmds.length === cmds.length ? path : new Path(nonZeroLengthCmds);
}

/**
 * Returns a list of transform matricies assigned to the specified node.
 */
function getNodeTransforms(node: SVGGraphicsElement | SVGClipPathElement) {
  if (!node.transform) {
    return [];
  }
  const transformList = node.transform.baseVal;
  const matrices: Matrix[] = [];
  for (let i = 0; i < transformList.numberOfItems; i++) {
    const { a, b, c, d, e, f } = transformList.getItem(i).matrix;
    matrices.push(new Matrix(a, b, c, d, e, f));
  }
  return matrices;
}

/**
 * Returns the name of the referenced ID assigned to the clip-path attribute,
 * if one exists.
 */
function getReferencedClipPathId(node: Element) {
  const clipPathAttr = node.getAttribute('clip-path')?.trim();
  if (!clipPathAttr || !clipPathAttr.startsWith('url(#')) {
    return undefined;
  }
  const endParenIndex = clipPathAttr.indexOf(')');
  if (endParenIndex !== clipPathAttr.length - 1) {
    return undefined;
  }
  return clipPathAttr.slice('url(#'.length, endParenIndex);
}

interface PathInfo {
  readonly path: Path;
  readonly refClipPathId?: string;
}

interface ClipPathInfo {
  readonly pathInfos: ReadonlyArray<PathInfo>;
  readonly refClipPathId?: string;
}

/**
 * Builds a map of clip path IDs to their corresponding clip path nodes.
 */
function buildClipPathIdMap(rootNode: Element) {
  const clipPathIdMap: Dictionary<SVGClipPathElement> = {};
  (function recurseFn(node: Element) {
    if (node instanceof SVGClipPathElement) {
      const clipPathId = node.getAttribute('id');
      if (clipPathId) {
        clipPathIdMap[clipPathId] = node;
      }
      return;
    }
    if (node && node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        recurseFn(node.childNodes.item(i) as Element);
      }
    }
  })(rootNode);
  return clipPathIdMap;
}

/**
 * Builds a list of path info objects for the specified clip path element.
 */
function buildPathInfosForClipPath(node: SVGClipPathElement) {
  // TODO: make sure that transforms from parent clip-paths aren't inherited...
  const clipPathTransforms = getNodeTransforms(node).reverse();

  const pathInfos: PathInfo[] = [];
  if (node.childNodes) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const childNode = node.childNodes.item(i);
      if (!(childNode instanceof SVGPathElement)) {
        continue;
      }
      const pathStr = childNode.getAttribute('d');
      if (!pathStr) {
        continue;
      }
      const pathTransforms = getNodeTransforms(childNode).reverse();
      const transforms = [...pathTransforms, ...clipPathTransforms];
      const refClipPathId = getReferencedClipPathId(childNode);
      pathInfos.push({
        refClipPathId,
        path: new Path(
          parsePath(pathStr)
            .mutate()
            .transform(Matrix.flatten(transforms))
            .build()
            .getPathString(),
        ),
      });
    }
  }
  return pathInfos;
}

/**
 * Builds a map of clip path IDs to their corresponding path info objects.
 */
function buildPathInfosMap(root: Element) {
  const clipPathInfoMap = _.mapValues(buildClipPathIdMap(root), n => {
    const pathInfos = buildPathInfosForClipPath(n);
    const refClipPathId = getReferencedClipPathId(n);
    return { pathInfos, refClipPathId } as ClipPathInfo;
  });
  const pathInfosMap: Dictionary<ReadonlyArray<PathInfo>> = {};
  const recurseFn = (clipPathId: string) => {
    if (pathInfosMap[clipPathId]) {
      // Then the path infos have already been computed.
      return;
    }
    const { pathInfos, refClipPathId } = clipPathInfoMap[clipPathId];
    if (!refClipPathId) {
      // Then simply assign the path infos to the clip path id.
      pathInfosMap[clipPathId] = pathInfos;
      return;
    }
    // Then concatenate the clip path's path info objects with its
    // referenced path info objects.
    recurseFn(refClipPathId);
    pathInfosMap[clipPathId] = [...pathInfos, ...pathInfosMap[refClipPathId]];
  };
  Object.keys(clipPathInfoMap).forEach(recurseFn);
  return pathInfosMap;
}
