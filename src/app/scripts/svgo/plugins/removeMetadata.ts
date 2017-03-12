export const removeMetadata = {
  active: true,
  type: 'perItem',
  fn: removeMetadataFn,
  params: undefined,
};

/**
 * Remove <metadata>.
 *
 * http://www.w3.org/TR/SVG/metadata.html
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeMetadataFn(item) {
  return !item.isElem('metadata');
}
