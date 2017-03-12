export const removeEmptyAttrs = {
  active: true,
  type: 'perItem',
  fn: removeEmptyAttrsFn,
  params: undefined,
};

/**
 * Remove attributes with empty values.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeEmptyAttrsFn(item) {
  if (item.elem) {
    item.eachAttr(function (attr) {
      if (attr.value === '') {
        item.removeAttr(attr.name);
      }
    });
  }
}
