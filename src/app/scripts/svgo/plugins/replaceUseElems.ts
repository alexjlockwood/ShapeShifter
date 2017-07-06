export const replaceUseElems = {
  active: true,
  type: 'full',
  fn: replaceUseElemsFn,
  params: undefined,
};

/**
 * Replace <use> elems with their referenced content.
 *
 * @param {Object} document the root document
 * @param {Object} params plugin params
 */
function replaceUseElemsFn(document, params) {
  const defsElems = document.querySelectorAll('defs') || [];

  const queryReferencedElementFn = (selector: string) => {
    for (const defs of defsElems) {
      const referencedElem = defs.querySelector(selector);
      if (referencedElem) {
        // Remove the style to avoid circular reference during clone.
        delete referencedElem.style;
        return referencedElem.clone();
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

    const addAttrFn = function(elem, attrName: string, attrValue: string) {
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
