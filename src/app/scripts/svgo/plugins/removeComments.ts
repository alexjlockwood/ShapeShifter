export const removeComments = {
  active: true,
  type: 'perItem',
  fn: removeCommentsFn,
  params: undefined,
};

/**
 * Remove comments.
 *
 * @example
 * <!-- Generator: Adobe Illustrator 15.0.0, SVG Export
 * Plug-In . SVG Version: 6.00 Build 0)  -->
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeCommentsFn(item) {
  if (item.comment && item.comment.charAt(0) !== '!') {
    return false;
  }
  return undefined;
}
