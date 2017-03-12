import * as collections from './_collections';

export const removeEmptyContainers = {
  active: true,
  type: 'perItemReverse',
  fn: removeEmptyContainersFn,
  params: undefined,
};

const container = collections.elemsGroups.container;

/**
 * Remove empty containers.
 *
 * @see http://www.w3.org/TR/SVG/intro.html#TermContainerElement
 *
 * @example
 * <defs/>
 *
 * @example
 * <g><marker><a/></marker></g>
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeEmptyContainersFn(item) {
  return !(item.isElem(container)
    && !item.isElem('svg')
    && item.isEmpty()
    && (!item.isElem('pattern') || !item.hasAttrLocal('href')));
}
