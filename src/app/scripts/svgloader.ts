import { Layer, VectorLayer, GroupLayer, PathLayer } from './models';
import * as ColorUtil from './colorutil';
import { SvgPathData } from './svgpathdata';
import * as ModelUtil from './modelutil';


export function loadVectorLayerFromSvgString(svgString: string): VectorLayer {
  let parser = new DOMParser();
  let doc = parser.parseFromString(svgString, 'image/svg+xml');

  let sanitizeId_ = (value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  };

  let usedIds = {};

  let makeFinalNodeId_ = (node, typeIdPrefix) => {
    let finalId = ModelUtil.getUniqueId({
      prefix: sanitizeId_(node.id || typeIdPrefix),
      objectById: id => usedIds[id],
    });
    usedIds[finalId] = true;
    return finalId;
  };

  let lengthPx_ = svgLength => {
    if (svgLength.baseVal) {
      svgLength = svgLength.baseVal;
    }
    svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
    return svgLength.valueInSpecifiedUnits;
  };

  let nodeToLayerData_ = (node, context): Layer => {
    if (!node) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) {
      return null;
    }

    let simpleAttr_ = (nodeAttr, contextAttr) => {
      if (node.attributes[nodeAttr]) {
        context[contextAttr] = node.attributes[nodeAttr].value;
      }
    };

    // set attributes
    simpleAttr_('stroke', 'strokeColor');
    simpleAttr_('stroke-width', 'strokeWidth');
    simpleAttr_('stroke-linecap', 'strokeLinecap');
    simpleAttr_('stroke-linejoin', 'strokeLinejoin');
    simpleAttr_('stroke-miterlimit', 'strokeMiterLimit');
    simpleAttr_('stroke-opacity', 'strokeAlpha');
    simpleAttr_('fill', 'fillColor');
    simpleAttr_('fill-opacity', 'fillAlpha');

    // add transforms

    if (node.transform) {
      let transforms = Array.from(node.transform.baseVal);
      transforms.reverse();
      context.transforms = context.transforms ? context.transforms.slice() : [];
      context.transforms.splice(0, 0, ...transforms);
    }

    // see if this is a path
    let path;
    if (node instanceof SVGPathElement) {
      path = (<any>node.attributes).d.value;

    } else if (node instanceof SVGRectElement) {
      let l = lengthPx_(node.x),
        t = lengthPx_(node.y),
        r = l + lengthPx_(node.width),
        b = t + lengthPx_(node.height);
      path = `M ${l},${t} ${r},${t} ${r},${b} ${l},${b} Z`;

    } else if (node instanceof SVGLineElement) {
      let x1 = lengthPx_(node.x1),
        y1 = lengthPx_(node.y1),
        x2 = lengthPx_(node.x2),
        y2 = lengthPx_(node.y2);
      path = `M ${x1},${y1} ${x2},${y2} Z`;

    } else if (node instanceof SVGPolygonElement || node instanceof SVGPolylineElement) {
      path = 'M ' + Array.from(<any>(node.points)).map((pt: any) => pt.x + ',' + pt.y).join(' ');
      if (node instanceof SVGPolygonElement) {
        path += ' Z';
      }

    } else if (node instanceof SVGCircleElement) {
      let cx = lengthPx_(node.cx),
        cy = lengthPx_(node.cy),
        r = lengthPx_(node.r);
      path = `M ${cx},${cy - r} A ${r} ${r} 0 1 0 ${cx},${cy + r} A ${r} ${r} 0 1 0 ${cx},${cy - r} Z`;

    } else if (node instanceof SVGEllipseElement) {
      let cx = lengthPx_(node.cx),
        cy = lengthPx_(node.cy),
        rx = lengthPx_(node.rx),
        ry = lengthPx_(node.ry);
      path = `M ${cx},${cy - ry} A ${rx} ${ry} 0 1 0 ${cx},${cy + ry} ` +
        `A ${rx} ${ry} 0 1 0 ${cx},${cy - ry} Z`;
    }

    if (path) {
      // transform all points
      if (context.transforms && context.transforms.length) {
        let pathData = new SvgPathData(path);
        pathData.transform(context.transforms);
        path = pathData.pathString;
      }

      // create a path layer
      return new PathLayer(
        makeFinalNodeId_(node, 'path'),
        new SvgPathData(path),
        ('fillColor' in context) ? ColorUtil.svgToAndroidColor(context.fillColor) : null,
        ('fillAlpha' in context) ? context.fillAlpha : undefined,
        ('strokeColor' in context) ? ColorUtil.svgToAndroidColor(context.strokeColor) : null,
        ('strokeAlpha' in context) ? context.strokeAlpha : undefined,
        context.strokeWidth || undefined,
        context.strokeLinecap || undefined,
        context.strokeLinejoin || undefined,
        context.strokeMiterLimit || undefined,
      );
    }

    if (node.childNodes.length) {
      let layers = Array.from(node.childNodes)
        .map(child => nodeToLayerData_(child, Object.assign({}, context)))
        .filter(layer => !!layer);
      if (layers && layers.length) {
        // create a group (there are valid children)
        return new GroupLayer(
          layers,
          makeFinalNodeId_(node, 'group'),
        );
      }
    }

    return null;
  };

  let docElContext: any = {};
  let documentElement: any = doc.documentElement;
  let width = lengthPx_(documentElement.width);
  let height = lengthPx_(documentElement.height);

  if (documentElement.viewBox) {
    width = documentElement.viewBox.baseVal.width;
    height = documentElement.viewBox.baseVal.height;

    // fake a translate transform for the viewbox
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

  let rootLayer = nodeToLayerData_(documentElement, docElContext);
  let id = makeFinalNodeId_(documentElement, 'vector');
  let childrenLayers = rootLayer ? rootLayer.children : undefined;
  let alpha = documentElement.getAttribute('opacity') || undefined;

  return new VectorLayer(childrenLayers, id, width, height, alpha);
}
