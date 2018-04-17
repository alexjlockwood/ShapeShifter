import * as CSSClassList from 'svgo/lib/svgo/css-class-list';
import * as CSSStyleDeclaration from 'svgo/lib/svgo/css-style-declaration';
import * as JSAPI from 'svgo/lib/svgo/jsAPI';

export const replaceUseElems = {
  active: true,
  type: 'full',
  fn: replaceUseElemsFn,
  params: undefined as any,
};

/**
 * Replace <use> elems with their referenced content.
 *
 * @param {Object} document the root document
 * @param {Object} params plugin params
 */
function replaceUseElemsFn(document: any, params: any): any {
  const defsElems = document.querySelectorAll('defs') || [];

  const queryReferencedElementFn = (selector: string) => {
    for (const defs of defsElems) {
      const referencedElem = defs.querySelector(selector);
      if (referencedElem) {
        return cloneParsedSvg(referencedElem);
      }
    }
    return undefined;
  };

  // TODO: handle the case where a 'use' element references another 'use'
  // TODO: handle the circular dependency that could potentially result as well
  const useElems = document.querySelectorAll('use') || [];
  for (const use of useElems) {
    if (!use.hasAttr('xlink:href')) {
      continue;
    }
    const refElem = queryReferencedElementFn(use.attr('xlink:href').value);
    if (!refElem) {
      continue;
    }
    use.removeAttr('xlink:href');

    if (refElem.isElem('symbol')) {
      // TODO: determine whether we should support 'symbol' elements as well
      continue;
    }

    const addAttrFn = function(elem: any, attrName: string, attrValue: string) {
      elem.addAttr({
        name: attrName,
        value: attrValue,
        prefix: '',
        local: attrName,
      });
    };

    if (refElem.isElem('svg')) {
      // TODO: test this
      const svg = refElem;
      if (use.hasAttr('width')) {
        addAttrFn(svg, 'width', use.attr('width').value);
        use.removeAttr('width');
      }
      if (use.hasAttr('height')) {
        addAttrFn(svg, 'height', use.attr('height').value);
        use.removeAttr('height');
      }
    }

    // TODO: handle the NAN cases?
    let x = 0;
    let y = 0;
    if (use.hasAttr('x')) {
      x = +use.attr('x').value;
      use.removeAttr('x');
    }
    if (use.hasAttr('y')) {
      y = +use.attr('y').value;
      use.removeAttr('y');
    }
    if (x || y) {
      let transform = `translate(${x} ${y})`;
      if (use.hasAttr('transform')) {
        transform = use.attr('transform').value + ' ' + transform;
      }
      addAttrFn(use, 'transform', transform);
    }
    use.content = [refElem];
    refElem.parentNode = use;
    use.renameElem('g');
  }

  return document;
}

// Clone is currently broken. Hack it:
function cloneParsedSvg(svg: any): any {
  const clones = new Map();

  function cloneKeys(target: any, obj: any) {
    for (const key of Object.keys(obj)) {
      target[key] = clone(obj[key]);
    }
    return target;
  }

  function clone(obj: any) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (clones.has(obj)) {
      return clones.get(obj);
    }

    let objClone;

    if (obj.constructor === JSAPI) {
      objClone = new JSAPI({}, obj.parentNode);
      clones.set(obj, objClone);

      if (obj.parentNode) {
        objClone.parentNode = clone(obj.parentNode);
      }
      cloneKeys(objClone, obj);
    } else if (
      obj.constructor === CSSClassList ||
      obj.constructor === CSSStyleDeclaration ||
      obj.constructor === Object ||
      obj.constructor === Array
    ) {
      objClone = new obj.constructor();
      clones.set(obj, objClone);
      cloneKeys(objClone, obj);
    } else if (obj.constructor === Map) {
      objClone = new Map();
      clones.set(obj, objClone);

      for (const [key, val] of obj) {
        objClone.set(clone(key), clone(val));
      }
    } else if (obj.constructor === Set) {
      objClone = new Set();
      clones.set(obj, objClone);

      for (const val of obj) {
        objClone.add(clone(val));
      }
    } else {
      throw Error('unexpected type');
    }

    return objClone;
  }

  return clone(svg);
}
