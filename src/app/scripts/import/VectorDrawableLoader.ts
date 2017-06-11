import { ModelUtil } from 'app/scripts/common';
import { INTERPOLATORS } from 'app/scripts/model/interpolators';
import {
  ClipPathLayer,
  FillType,
  GroupLayer,
  Layer,
  PathLayer,
  StrokeLineCap,
  StrokeLineJoin,
  VectorLayer,
} from 'app/scripts/model/layers';
import { Path } from 'app/scripts/model/paths';
import { NameProperty } from 'app/scripts/model/properties';
import {
  AnimationBlock,
  PathAnimationBlock,
} from 'app/scripts/model/timeline';
import * as _ from 'lodash';

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
    const finalName = ModelUtil.getUniqueName(
      NameProperty.sanitize(value || prefix),
      name => doesLayerNameExistFn(name) || usedNames.has(name),
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
        pathData: new Path(get(node, 'pathData', '')),
        fillColor: get(node, 'fillColor', ''),
        fillAlpha: Number(get(node, 'fillAlpha', '1')),
        strokeColor: get(node, 'strokeColor', ''),
        strokeAlpha: Number(get(node, 'strokeAlpha', '1')),
        strokeWidth: Number(get(node, 'strokeWidth', '0')),
        strokeLinecap: get(node, 'strokeLineCap', 'butt') as StrokeLineCap,
        strokeLinejoin: get(node, 'strokeLineJoin', 'miter') as StrokeLineJoin,
        strokeMiterLimit: Number(get(node, 'strokeMiterLimit', '4')),
        trimPathStart: Number(get(node, 'trimPathStart', '0')),
        trimPathEnd: Number(get(node, 'trimPathEnd', '1')),
        trimPathOffset: Number(get(node, 'trimPathOffset', '0')),
        fillType: get(node, 'fillType', 'evenOdd') as FillType,
      });
    }

    if (node.tagName === 'clip-path') {
      return new ClipPathLayer({
        id: _.uniqueId(),
        name: makeFinalNodeIdFn(get(node, 'name', ''), 'clip-path'),
        children: [],
        pathData: new Path(get(node, 'pathData', '')),
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
          pivotX: Number(get(node, 'pivotX', '0')),
          pivotY: Number(get(node, 'pivotY', '0')),
          rotation: Number(get(node, 'rotation', '0')),
          scaleX: Number(get(node, 'scaleX', '1')),
          scaleY: Number(get(node, 'scaleY', '1')),
          translateX: Number(get(node, 'translateX', '0')),
          translateY: Number(get(node, 'translateY', '0')),
        });
      }
    }

    return undefined;
  };

  const rootLayer = nodeToLayerDataFn(docEl);
  const children = rootLayer ? rootLayer.children : [];
  const name = makeFinalNodeIdFn(get(docEl, 'name', ''), 'vector');
  usedNames.add(name);
  const width = Number(get(docEl, 'viewportWidth', '24'));
  const height = Number(get(docEl, 'viewportHeight', '24'));
  const alpha = Number(get(docEl, 'alpha', '1'));
  return new VectorLayer({ id: _.uniqueId(), name, children, width, height, alpha });
}

export function loadAnimationFromXmlString(
  xmlString: string,
  animationName: string,
  doesLayerNameExistFn: (name: string) => boolean) {

  const animationId = _.uniqueId();

  const parser = new DOMParser();
  const avdNode = parser.parseFromString(xmlString, 'application/xml').documentElement;
  const vl =
    _(Array.from(avdNode.childNodes))
      .filter(elem => {
        return isElement(elem)
          && elem.tagName === 'aapt:attr'
          && elem.hasAttribute('name')
          && elem.getAttribute('name') === 'android:drawable';
      })
      .map((elem: HTMLElement) => {
        return _(Array.from(elem.childNodes))
          .filter(e => isElement(e) && e.tagName === 'vector')
          .map((e: HTMLElement) => loadVectorLayerFromElement(e, doesLayerNameExistFn))
          .first();
      })
      .first();
  if (!vl) {
    return undefined;
  }
  const blocks =
    _(Array.from(avdNode.childNodes))
      .filter(e => {
        return isElement(e)
          && e.tagName === 'target'
          && !!e.getAttribute('android:name');
      })
      .flatMap((targetElem: HTMLElement) => {
        const targetName = targetElem.getAttribute('android:name');
        const layerId = vl.findLayerByName(targetName).id;
        const animElem =
          _(Array.from(targetElem.childNodes))
            .filter(elem => {
              return isElement(elem)
                && elem.tagName === 'aapt:attr'
                && elem.hasAttribute('name')
                && elem.getAttribute('name') === 'android:animation'
                && elem.childNodes.length;
            })
            .flatMap((elem: HTMLElement) => Array.from(elem.childNodes))
            .filter(e => isElement(e) && (e.tagName === 'set' || e.tagName === 'objectAnimator'))
            .map((e: HTMLElement) => {
              if (e.tagName === 'set') {
                // TODO: handle animator set case
                return undefined;
              }
              // Otherwise it is an object animator.
              return e;
            })
            .first() as HTMLElement;
        console.info(targetElem);
        const animationBlocks: AnimationBlock[] = [];
        const propertyName = get(animElem, 'propertyName');
        const fromValue = get(animElem, 'valueFrom');
        const toValue = get(animElem, 'valueTo');
        const interpolatorRef =
          get(animElem, 'interpolator', '@android:anim/accelerate_decelerate_interpolator');
        const interpolator = _.find(INTERPOLATORS, i => i.androidRef === interpolatorRef).value;
        const startTime = Number(get(animElem, 'startOffset'));
        const endTime = startTime + Number(get(animElem, 'duration'));
        if (get(animElem, 'valueType') === 'pathType' && propertyName === 'pathData') {
          animationBlocks.push(new PathAnimationBlock({
            animationId,
            layerId,
            propertyName,
            fromValue,
            toValue,
            startTime,
            endTime,
            interpolator,
          }));
        }
        // TODO: return a list of animation blocks here
        return animationBlocks;
      })
      .value();
  console.info(blocks);
  // const avdTargetElements = avdChildElements.filter(e => e.tagName === 'target');
  // avdTargetElements.forEach(e => getTargetFn(e));
  // console.info(vl, avdTargetElements);
  return undefined;
}

function isElement(node: Node): node is HTMLElement {
  return node
    && node.nodeType !== Node.TEXT_NODE
    && node.nodeType !== Node.COMMENT_NODE
    && _.isElement(node);
}

function get(obj: HTMLElement, attr: string, def = '') {
  const androidAttr = `android:${attr}`;
  return obj.hasAttribute(androidAttr) ? obj.getAttribute(androidAttr) : def;
}
