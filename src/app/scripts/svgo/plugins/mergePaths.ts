/* tslint:disable */

import * as paths from './_paths';

export const mergePaths = {
  active: true,
  type: 'perItem',
  fn: mergePathsFn,
  params: {
    collapseRepeated: true,
    leadingZero: true,
    negativeExtraSpace: true
  },
};

const path2js = paths.path2js;
const js2path = paths.js2path;
const intersects = paths.intersects;

/**
 * Merge multiple Paths into one.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function mergePathsFn(item, params) {

  if (!item.isElem() || item.isEmpty()) return;

  var prevContentItem = null,
    prevContentItemKeys = null;

  item.content = item.content.filter(function (contentItem) {

    if (prevContentItem &&
      prevContentItem.isElem('path') &&
      prevContentItem.isEmpty() &&
      prevContentItem.hasAttr('d') &&
      contentItem.isElem('path') &&
      contentItem.isEmpty() &&
      contentItem.hasAttr('d')
    ) {

      if (!prevContentItemKeys) {
        prevContentItemKeys = Object.keys(prevContentItem.attrs);
      }

      var contentItemAttrs = Object.keys(contentItem.attrs),
        equalData = prevContentItemKeys.length == contentItemAttrs.length &&
          contentItemAttrs.every(function (key) {
            return key == 'd' ||
              prevContentItem.hasAttr(key) &&
              prevContentItem.attr(key).value == contentItem.attr(key).value;
          }),
        prevPathJS = path2js(prevContentItem),
        curPathJS = path2js(contentItem);

      if (equalData && !intersects(prevPathJS, curPathJS)) {
        js2path(prevContentItem, prevPathJS.concat(curPathJS), params);
        return false;
      }
    }

    prevContentItem = contentItem;
    prevContentItemKeys = null;
    return true;

  });

};
