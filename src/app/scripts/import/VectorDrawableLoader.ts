import 'rxjs/add/operator/first';

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
} from 'app/model/layers';
import { Path } from 'app/model/paths';
import { NameProperty } from 'app/model/properties';
import { ColorUtil } from 'app/scripts/common';
import * as _ from 'lodash';

// import { INTERPOLATORS } from 'app/model/interpolators';
// import { AnimationBlock } from 'app/model/timeline';

export function loadVectorLayerFromXmlString(
  xmlString: string,
  doesLayerNameExistFn: (name: string) => boolean,
) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  return loadVectorLayerFromElement(doc.documentElement, doesLayerNameExistFn);
}

function loadVectorLayerFromElement(
  docEl: HTMLElement,
  doesLayerNameExistFn: (name: string) => boolean,
) {
  if (!docEl) {
    return undefined;
  }
  const usedNames = new Set<string>();
  const makeFinalNodeIdFn = (value: string, prefix: string) => {
    const finalName = LayerUtil.getUniqueName(
      NameProperty.sanitize(value || prefix),
      n => doesLayerNameExistFn(n) || usedNames.has(n),
    );
    usedNames.add(finalName);
    return finalName;
  };

  const nodeToLayerDataFn = (node: Node): Layer => {
    if (!isElement(node)) {
      return undefined;
    }

    if (node.tagName === 'path') {
      return new PathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(node.getAttribute('android:name'), 'path'),
        children: [],
        pathData: getPath(node),
        fillColor: getColor(node, 'fillColor', ''),
        fillAlpha: getNumber(node, 'fillAlpha', '1'),
        strokeColor: getColor(node, 'strokeColor', ''),
        strokeAlpha: getNumber(node, 'strokeAlpha', '1'),
        strokeWidth: getNumber(node, 'strokeWidth', '0'),
        strokeLinecap: get(node, 'strokeLineCap', 'butt') as StrokeLineCap,
        strokeLinejoin: get(node, 'strokeLineJoin', 'miter') as StrokeLineJoin,
        strokeMiterLimit: getNumber(node, 'strokeMiterLimit', '4'),
        trimPathStart: getNumber(node, 'trimPathStart', '0'),
        trimPathEnd: getNumber(node, 'trimPathEnd', '1'),
        trimPathOffset: getNumber(node, 'trimPathOffset', '0'),
        fillType: get(node, 'fillType', 'nonZero') as FillType,
      });
    }

    if (node.tagName === 'clip-path') {
      return new ClipPathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(get(node, 'name', ''), 'clip-path'),
        children: [],
        pathData: getPath(node),
      });
    }

    if (node.childNodes.length) {
      const children = Array.from(node.childNodes)
        .map(child => nodeToLayerDataFn(child))
        .filter(child => !!child);
      if (children && children.length) {
        return new GroupLayer({
          id: _.uniqueId(),
          name: makeFinalNodeIdFn(get(node, 'name', ''), 'group'),
          children,
          pivotX: getNumber(node, 'pivotX', '0'),
          pivotY: getNumber(node, 'pivotY', '0'),
          rotation: getNumber(node, 'rotation', '0'),
          scaleX: getNumber(node, 'scaleX', '1'),
          scaleY: getNumber(node, 'scaleY', '1'),
          translateX: getNumber(node, 'translateX', '0'),
          translateY: getNumber(node, 'translateY', '0'),
        });
      }
    }

    return undefined;
  };

  const rootLayer = nodeToLayerDataFn(docEl);
  const name = makeFinalNodeIdFn(get(docEl, 'name', ''), 'vector');
  usedNames.add(name);
  const width = getNumber(docEl, 'viewportWidth', '24');
  const height = getNumber(docEl, 'viewportHeight', '24');
  const alpha = getNumber(docEl, 'alpha', '1');
  return new VectorLayer({
    id: _.uniqueId(),
    name,
    children: rootLayer ? rootLayer.children : [],
    width,
    height,
    alpha,
  });
}

// export function loadAnimationFromXmlString(
//   xmlString: string,
//   animationName: string,
//   doesLayerNameExistFn: (name: string) => boolean) {

//   const parser = new DOMParser();
//   const avdNode = parser.parseFromString(xmlString, 'application/xml').documentElement;
//   const vl =
//     _(Array.from(avdNode.childNodes))
//       .filter(elem => {
//         return isElement(elem)
//           && elem.tagName === 'aapt:attr'
//           && elem.hasAttribute('name')
//           && elem.getAttribute('name') === 'android:drawable';
//       })
//       .map((elem: HTMLElement) => {
//         return _(Array.from(elem.childNodes))
//           .filter(e => isElement(e) && e.tagName === 'vector')
//           .map((e: HTMLElement) => loadVectorLayerFromElement(e, doesLayerNameExistFn))
//           .first();
//       })
//       .first();
//   if (!vl) {
//     return undefined;
//   }
//   const blocks =
//     _(Array.from(avdNode.childNodes))
//       .filter(e => {
//         return isElement(e)
//           && e.tagName === 'target'
//           && !!e.getAttribute('android:name');
//       })
//       .flatMap((targetElem: HTMLElement) => {
//         const targetName = targetElem.getAttribute('android:name');
//         const layerId = vl.findLayerByName(targetName).id;
//         const animElem =
//           _(Array.from(targetElem.childNodes))
//             .filter(elem => {
//               return isElement(elem)
//                 && elem.tagName === 'aapt:attr'
//                 && elem.hasAttribute('name')
//                 && elem.getAttribute('name') === 'android:animation'
//                 && elem.childNodes.length;
//             })
//             .flatMap((elem: HTMLElement) => Array.from(elem.childNodes))
//             .filter(e => isElement(e) && (e.tagName === 'set' || e.tagName === 'objectAnimator'))
//             .map((e: HTMLElement) => {
//               if (e.tagName === 'set') {
//                 // TODO: handle animator set case
//                 return undefined;
//               }
//               // Otherwise it is an object animator.
//               return e;
//             })
//             .first() as HTMLElement;
//         const animationBlocks: AnimationBlock[] = [];
//         const propertyName = get(animElem, 'propertyName');
//         const fromValue = get(animElem, 'valueFrom');
//         const toValue = get(animElem, 'valueTo');
//         // TODO: confirm difference between @android:anim and @android:interpolator
//         // TODO: @android:interpolator/linear doesn't work
//         const interpolatorRef =
//           get(animElem, 'interpolator', '@android:anim/accelerate_decelerate_interpolator');
//         const interpolator = _.find(INTERPOLATORS, i => i.androidRef === interpolatorRef).value;
//         const startTime = Number(get(animElem, 'startOffset'));
//         const endTime = startTime + Number(get(animElem, 'duration'));
//         if (get(animElem, 'valueType') === 'pathType' && propertyName === 'pathData') {
//           animationBlocks.push(AnimationBlock.from({
//             layerId,
//             propertyName,
//             fromValue: new Path(fromValue),
//             toValue: new Path(toValue),
//             startTime,
//             endTime,
//             interpolator,
//             type: 'path',
//           }));
//         } else if (propertyName === 'fillAlpha' || propertyName === 'translateX') {
//           animationBlocks.push(AnimationBlock.from({
//             layerId,
//             propertyName,
//             fromValue: Number(fromValue),
//             toValue: Number(toValue),
//             startTime,
//             endTime,
//             interpolator,
//             type: 'number',
//           }));
//         }
//         // TODO: return a list of animation blocks here
//         return animationBlocks;
//       })
//       .value();
// const avdTargetElements = avdChildElements.filter(e => e.tagName === 'target');
// avdTargetElements.forEach(e => getTargetFn(e));
// console.info(vl, avdTargetElements);
//   return undefined;
// }

function isElement(node: Node): node is HTMLElement {
  return (
    node &&
    node.nodeType !== Node.TEXT_NODE &&
    node.nodeType !== Node.COMMENT_NODE &&
    _.isElement(node)
  );
}

function get(obj: HTMLElement, attr: string, def = '') {
  const androidAttr = `android:${attr}`;
  return obj.hasAttribute(androidAttr) ? obj.getAttribute(androidAttr) : def;
}

function getNumber(obj: HTMLElement, attr: string, def: string) {
  const androidAttr = `android:${attr}`;
  const num = Number(obj.hasAttribute(androidAttr) ? obj.getAttribute(androidAttr) : def);
  return isFinite(num) ? num : Number(def);
}

function getPath(obj: HTMLElement) {
  const androidAttr = 'android:pathData';
  const pathData = obj.hasAttribute(androidAttr) ? obj.getAttribute(androidAttr) : '';
  try {
    return new Path(pathData);
  } catch (e) {
    console.warn('Failed to import pathData: ', pathData);
    return undefined;
  }
}

function getColor(obj: HTMLElement, attr: string, def = '') {
  const androidAttr = `android:${attr}`;
  const color = obj.hasAttribute(androidAttr) ? obj.getAttribute(androidAttr) : def;
  return !!ColorUtil.parseAndroidColor(color) ? color : def;
}
