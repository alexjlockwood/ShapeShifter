export const replaceUseElems = {
  active: true,
  type: 'perItem',
  fn: replaceUseElemsFn,
  params: undefined,
};

/**
 * Replace <use> elems with their referenced content.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function replaceUseElemsFn(item) {
  return !item.isElem('metadata');
}
