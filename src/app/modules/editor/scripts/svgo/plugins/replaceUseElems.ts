import { type CustomPlugin, querySelectorAll, type XastElement } from 'svgo/browser';

/**
 * Replace <use> elems with their referenced content.
 */
export const replaceUseElems: CustomPlugin = {
  name: 'replaceUseElems',
  fn: root => {
    // Maps ids to elements defined inside of a <defs> element.
    const defsElemsById = new Map<string, XastElement>();
    const collectIdsFn = (elem: XastElement) => {
      for (const child of elem.children) {
        if (child.type !== 'element') {
          continue;
        }
        const { id } = child.attributes;
        if (id !== undefined && !defsElemsById.has(id)) {
          defsElemsById.set(id, child);
        }
        collectIdsFn(child);
      }
    };
    for (const defs of querySelectorAll(root, 'defs')) {
      collectIdsFn(defs as XastElement);
    }

    const queryReferencedElementFn = (href: string) => {
      const referencedElem = href.startsWith('#') ? defsElemsById.get(href.slice(1)) : undefined;
      return referencedElem ? structuredClone(referencedElem) : undefined;
    };

    // TODO: handle the case where a 'use' element references another 'use'
    // TODO: handle the circular dependency that could potentially result as well
    for (const use of querySelectorAll(root, 'use') as XastElement[]) {
      const { attributes: attrs } = use;
      const href = attrs['xlink:href'];
      if (href === undefined) {
        continue;
      }
      const refElem = queryReferencedElementFn(href);
      if (!refElem) {
        continue;
      }
      delete attrs['xlink:href'];

      if (refElem.name === 'symbol') {
        // TODO: determine whether we should support 'symbol' elements as well
        continue;
      }

      if (refElem.name === 'svg') {
        // TODO: test this
        if (attrs.width !== undefined) {
          refElem.attributes.width = attrs.width;
          delete attrs.width;
        }
        if (attrs.height !== undefined) {
          refElem.attributes.height = attrs.height;
          delete attrs.height;
        }
      }

      // TODO: handle the NAN cases?
      let x = 0;
      let y = 0;
      if (attrs.x !== undefined) {
        x = +attrs.x;
        delete attrs.x;
      }
      if (attrs.y !== undefined) {
        y = +attrs.y;
        delete attrs.y;
      }
      if (x || y) {
        let transform = `translate(${x} ${y})`;
        if (attrs.transform !== undefined) {
          transform = attrs.transform + ' ' + transform;
        }
        attrs.transform = transform;
      }
      use.children = [refElem];
      use.name = 'g';
    }
  },
};
