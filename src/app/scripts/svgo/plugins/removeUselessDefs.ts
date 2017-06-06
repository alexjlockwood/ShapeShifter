import * as collections from './_collections';

export const removeUselessDefs = {
  active: true,
  type: 'perItem',
  fn: removeUselessDefsFn,
  params: undefined,
};

const nonRendering = collections.elemsGroups.nonRendering;
let defs;

/**
 * Removes content of defs and properties that aren't rendered directly without ids.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeUselessDefsFn(item) {
  if (item.isElem('defs')) {
    defs = item;
    item.content = (item.content || []).reduce(getUsefulItems, []);
    if (item.isEmpty()) {
      return false;
    }
  } else if (item.isElem(nonRendering) && !item.hasAttr('id')) {
    return false;
  }
  return undefined;
}

function getUsefulItems(usefulItems, item) {
  if (item.hasAttr('id') || item.isElem('style')) {
    usefulItems.push(item);
    item.parentNode = defs;
  } else if (!item.isEmpty()) {
    item.content.reduce(getUsefulItems, usefulItems);
  }
  return usefulItems;
}
