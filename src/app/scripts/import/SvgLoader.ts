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

  // TODO: handle clip paths referencing other clip paths
  const clipPathMap = {};

  const nodeToLayerDataFn = (node, attrMap: Map<string, any>, transforms: ReadonlyArray<Matrix>): Layer => {
    if (!node
      || node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE
      || node instanceof SVGDefsElement
      || node instanceof SVGUseElement) {
      return undefined;
    }

    const simpleAttrFn = (nodeAttr: string, contextAttr: string) => {
      if (node.hasAttribute(nodeAttr)) {
        attrMap.set(contextAttr, node.getAttribute(nodeAttr));
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
      const matrices = Array.from(node.transform.baseVal).reverse().map(t => {
        const { a, b, c, d, e, f } = (t as any).matrix;
        return new Matrix(a, b, c, d, e, f);
      });
      transforms = [...matrices, ...transforms];
    }

    let path = '';
    if (node instanceof SVGPathElement && node.hasAttribute('d')) {
      path = node.getAttribute('d');
    }

    if (path) {
      // Set the default values as specified by the SVG spec. Note that some of these default
      // values are different than the default values used by VectorDrawables.
      const fillColor =
        attrMap.has('fillColor') ? ColorUtil.svgToAndroidColor(attrMap.get('fillColor')) : '#000';
      const strokeColor =
        attrMap.has('strokeColor') ? ColorUtil.svgToAndroidColor(attrMap.get('strokeColor')) : undefined;
      const fillAlpha = attrMap.has('fillAlpha') ? Number(attrMap.get('fillAlpha')) : 1;
      let strokeWidth = attrMap.has('strokeWidth') ? Number(attrMap.get('strokeWidth')) : 1;
      const strokeAlpha = attrMap.has('strokeAlpha') ? Number(attrMap.get('strokeAlpha')) : 1;
      const strokeLinecap: StrokeLineCap =
        attrMap.has('strokeLinecap') ? attrMap.get('strokeLinecap') : 'butt';
      const strokeLinejoin: StrokeLineJoin =
        attrMap.has('strokeLinejoin') ? attrMap.get('strokeLinecap') : 'miter';
      const strokeMiterLimit =
        attrMap.has('strokeMiterLimit') ? Number(attrMap.get('strokeMiterLimit')) : 4;
      const fillRuleToFillTypeFn = (fillRule: string) => {
        return fillRule === 'evenodd' ? 'evenOdd' : 'nonZero';
      };
      const fillType: FillType =
        attrMap.has('fillType') ? fillRuleToFillTypeFn(attrMap.get('fillType')) : 'nonZero';

      let pathData = new Path(path);
      if (transforms.length) {
        pathData = new Path(pathData.mutate().addTransforms(transforms).build().getPathString());
        const flattenedTransform = Matrix.flatten(...transforms);
        strokeWidth *= flattenedTransform.getScale();
      }

      const layer: Layer =
        new PathLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(node, 'path'),
          children: [],
          pathData: new Path(pathData.getPathString()),
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

      if (node.hasAttribute('clip-path')) {
        let referencedClipPath = node.getAttribute('clip-path');
        if (referencedClipPath) {
          referencedClipPath = referencedClipPath.trim();
          if (referencedClipPath.startsWith('url(#')) {
            const endIndex = referencedClipPath.indexOf(')');
            if (endIndex === referencedClipPath.length - 1) {
              referencedClipPath = referencedClipPath.slice(5, endIndex);
              let paths: Path[] = clipPathMap[referencedClipPath];
              // TODO: if an empty clip path, mask the entire thing
              if (paths && paths.length) {
                paths = paths.map(p => p.mutate().addTransforms(transforms).build());
                const groupChildren: Layer[] = [];
                for (const p of paths) {
                  groupChildren.push(new ClipPathLayer({
                    name: makeFinalNodeIdFn(referencedClipPath, 'mask'),
                    pathData: new Path(p.getPathString()),
                    children: [],
                  }));
                }
                groupChildren.push(layer);
                return new GroupLayer({
                  name: makeFinalNodeIdFn('group', 'group'),
                  children: groupChildren,
                });
              }
            }
          }
        }
      }

      return layer;
    }

    if (node.childNodes.length) {
      const children = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child, new Map(attrMap), transforms))
        .filter(child => !!child);

      const layer = new GroupLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node, 'group'),
        children,
      });
      if (children.length) {
        if (node.hasAttribute('clip-path')) {
          let referencedClipPath = node.getAttribute('clip-path');
          if (referencedClipPath) {
            referencedClipPath = referencedClipPath.trim();
            if (referencedClipPath.startsWith('url(#')) {
              const endIndex = referencedClipPath.indexOf(')');
              if (endIndex === referencedClipPath.length - 1) {
                referencedClipPath = referencedClipPath.slice(5, endIndex);
                let paths: Path[] = clipPathMap[referencedClipPath];
                // TODO: if an empty clip path, mask the entire thing
                if (paths && paths.length) {
                  paths = paths.map(p => p.mutate().addTransforms(transforms).build());
                  const groupChildren: Layer[] = [];
                  for (const p of paths) {
                    groupChildren.push(new ClipPathLayer({
                      name: makeFinalNodeIdFn(referencedClipPath, 'mask'),
                      pathData: new Path(p.getPathString()),
                      children: [],
                    }));
                  }
                  groupChildren.push(layer);
                  return new GroupLayer({
                    name: makeFinalNodeIdFn('group', 'group'),
                    children: groupChildren,
                  });
                }
              }
            }
          }
        }

        return layer;
      }
    }

    return undefined;
  };

  const parser = new DOMParser();
  const { documentElement } = parser.parseFromString(svgString, 'image/svg+xml');
  if (!isSvgNode(documentElement)) {
    return undefined;
  }

  const getClipPathsFn = (node: any) => {
    if (!node
      || node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE) {
      return;
    }
    if (node instanceof SVGClipPathElement) {
      let clipPathTransforms: ReadonlyArray<Matrix> = [];
      if (node.transform) {
        clipPathTransforms =
          Array.from(node.transform.baseVal as any).reverse().map(t => {
            const { a, b, c, d, e, f } = (t as any).matrix;
            return new Matrix(a, b, c, d, e, f);
          });
      }
      if (node.childNodes.length) {
        const nodes = [];
        for (let i = 0; i < node.childNodes.length; i++) {
          const n = node.childNodes.item(i);
          if (n.nodeName === 'path') {
            nodes.push(n);
          }
        }
        const paths = nodes.map((child: SVGPathElement) => {
          let pathTransforms: Matrix[] = [...clipPathTransforms];
          if (child.transform) {
            const matrices = Array.from(child.transform.baseVal as any).reverse().map(t => {
              const { a, b, c, d, e, f } = (t as any).matrix;
              return new Matrix(a, b, c, d, e, f);
            });
            pathTransforms = [...matrices, ...pathTransforms];
          }
          const path = child.hasAttribute('d') ? child.getAttribute('d') : '';
          if (path) {
            const p = new Path(path).mutate().addTransforms(pathTransforms).build();
            return new Path(p.getPathString());
          }
          return undefined;
        }).filter(path => !!path);
        console.info('setting id:', node.getAttribute('id'), paths);
        clipPathMap[node.getAttribute('id')] = paths;
      }
      return;
    }
    if (node.childNodes.length) {
      Array.from(node.childNodes).forEach(child => getClipPathsFn(child));
    }
  };
  getClipPathsFn(documentElement);

  console.info(clipPathMap);

  const lengthPxFn = svgLength => {
    if (svgLength.baseVal) {
      svgLength = svgLength.baseVal;
    }
    svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
    return svgLength.valueInSpecifiedUnits;
  };
  let width = lengthPxFn(documentElement.width) || undefined;
  let height = lengthPxFn(documentElement.height) || undefined;

  const transforms: Matrix[] = [];
  const attrMap = new Map<string, any>();
  const { viewBox } = documentElement;
  if (viewBox && (!!viewBox.baseVal.width || !!viewBox.baseVal.height)) {
    width = viewBox.baseVal.width;
    height = viewBox.baseVal.height;

    // Fake a translate transform for the viewbox.
    transforms.push(Matrix.fromTranslation(-viewBox.baseVal.x, -viewBox.baseVal.y));
  }

  const rootLayer = nodeToLayerDataFn(documentElement, attrMap, transforms);
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

function isSvgNode(node: Element): node is SVGSVGElement {
  return node.nodeName === 'svg';
}
