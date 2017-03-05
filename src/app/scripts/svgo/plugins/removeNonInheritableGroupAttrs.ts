import * as collections from './_collections';

export const removeNonInheritableGroupAttrs = {
  active: true,
  type: 'perItem',
  fn: removeNonInheritableGroupAttrsFn,
  params: undefined,
};

const inheritableAttrs = collections.inheritableAttrs,
  attrsGroups = collections.attrsGroups,
  excludedAttrs = ['display', 'opacity'];

/**
 * Remove non-inheritable group's "presentation" attributes.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeNonInheritableGroupAttrsFn(item) {
  if (item.isElem('g')) {
    item.eachAttr(function (attr) {
      if (
        ~attrsGroups.presentation.indexOf(attr.name) &&
        ~attrsGroups.graphicalEvent.indexOf(attr.name) &&
        ~attrsGroups.core.indexOf(attr.name) &&
        ~attrsGroups.conditionalProcessing.indexOf(attr.name) &&
        !~excludedAttrs.indexOf(attr.name) &&
        !~inheritableAttrs.indexOf(attr.name)
      ) {
        item.removeAttr(attr.name);
      }
    });
  }
};
