import * as _ from 'lodash';
import { VectorLayer, GroupLayer, PathLayer, ClipPathLayer } from '../layers';
import { newPath } from '../commands';
import { ColorUtil, Matrix } from '../common';
import { Svgo } from '../svgo';
import { environment } from '../../../environments/environment';

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

  // Construct a map of elements contained within <defs> tags, mapping
  // their IDs to the element nodes.
  const defsChildMap = new Map();
  const extractDefsMapFn = (node: Node) => {
    if (!node) {
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child instanceof SVGDefsElement) {
        for (let j = 0; j < child.childNodes.length; j++) {
          const defs = child.childNodes[j];
          if (defs.nodeType !== Node.TEXT_NODE
            && defs.nodeType !== Node.COMMENT_NODE) {
            defsChildMap.set((defs as any).id, defs);
          }
        }
      } else {
        extractDefsMapFn(child);
      }
    }
  };

  const nodeToLayerDataFn = (node, context): GroupLayer | ClipPathLayer | PathLayer => {
    if (!node) {
      return undefined;
    }

    if (node.nodeType === Node.TEXT_NODE
      || node.nodeType === Node.COMMENT_NODE
      || node instanceof SVGDefsElement) {
      return undefined;
    }

    // If the node is a <use> element, then replace it with the element
    // contained in the defs map constructed above.
    if (node instanceof SVGUseElement) {
      // TODO: apparently xlink:href is deprecated... figure out what to do about that
      let defChildId = node.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      // TODO: can we assume the href is formatted like '#idNameGoesHere'?
      defChildId = defChildId.substring(1);
      const replacementNode = defsChildMap.get(defChildId);
      if (!replacementNode) {
        return undefined;
      }
      node = replacementNode.cloneNode(true);
      node.id = defChildId;
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

    if (node.transform) {
      const transforms = Array.from(node.transform.baseVal).reverse();
      context.transforms = context.transforms ? context.transforms.slice() : [];
      context.transforms.splice(0, 0, ...transforms);
    }

    let path;
    if (node instanceof SVGPathElement) {
      path = node.attributes ? (node.attributes as any).d.value : '';

    } else if (node instanceof SVGRectElement) {
      const l = lengthPxFn(node.x),
        t = lengthPxFn(node.y),
        r = l + lengthPxFn(node.width),
        b = t + lengthPxFn(node.height);
      // TODO: need to handle corner radii as well (rx/ry)
      path = `M ${l},${t} ${r},${t} ${r},${b} ${l},${b} Z`;

    } else if (node instanceof SVGLineElement) {
      const x1 = lengthPxFn(node.x1),
        y1 = lengthPxFn(node.y1),
        x2 = lengthPxFn(node.x2),
        y2 = lengthPxFn(node.y2);
      path = `M ${x1},${y1} ${x2},${y2} Z`;

    } else if (node instanceof SVGPolygonElement || node instanceof SVGPolylineElement) {
      path = 'M ' + Array.from((node.points as any)).map((pt: any) => pt.x + ',' + pt.y).join(' ');
      if (node instanceof SVGPolygonElement) {
        path += ' Z';
      }

    } else if (node instanceof SVGCircleElement) {
      const cx = lengthPxFn(node.cx),
        cy = lengthPxFn(node.cy),
        r = lengthPxFn(node.r);
      path = `M ${cx},${cy - r} A ${r} ${r} 0 1 0 ${cx},${cy + r} `
        + `A ${r} ${r} 0 1 0 ${cx},${cy - r} Z`;

    } else if (node instanceof SVGEllipseElement) {
      const cx = lengthPxFn(node.cx),
        cy = lengthPxFn(node.cy),
        rx = lengthPxFn(node.rx),
        ry = lengthPxFn(node.ry);
      path = `M ${cx},${cy - ry} A ${rx} ${ry} 0 1 0 ${cx},${cy + ry} ` +
        `A ${rx} ${ry} 0 1 0 ${cx},${cy - ry} Z`;
    }

    if (path) {
      let pathData = newPath(path);
      if (context.transforms && context.transforms.length) {
        const transforms = context.transforms.map(t => t.matrix as Matrix);
        pathData = newPath(
          _.chain(pathData.getSubPaths())
            .flatMap(subPath => subPath.getCommands())
            .map(command => command.transform(transforms))
            .value());
      }

      const fillColor =
        ('fillColor' in context) ? ColorUtil.svgToAndroidColor(context.fillColor) : '#ff000000';
      const strokeColor =
        ('strokeColor' in context) ? ColorUtil.svgToAndroidColor(context.strokeColor) : undefined;
      return new PathLayer(
        makeFinalNodeIdFn(node, 'path'),
        pathData,
        fillColor,
        ('fillAlpha' in context) ? context.fillAlpha : undefined,
        strokeColor,
        ('strokeAlpha' in context) ? context.strokeAlpha : undefined,
        context.strokeWidth || undefined,
        context.strokeLinecap || undefined,
        context.strokeLinejoin || undefined,
        context.strokeMiterLimit || undefined,
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

  extractDefsMapFn(doc.documentElement);
  const rootLayer = nodeToLayerDataFn(documentElement, docElContext);
  const id = makeFinalNodeIdFn(documentElement, 'vector');
  const childrenLayers = rootLayer ? rootLayer.children : undefined;
  const alpha = documentElement.getAttribute('opacity') || undefined;

  return new VectorLayer(childrenLayers, id, width, height, alpha);
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
