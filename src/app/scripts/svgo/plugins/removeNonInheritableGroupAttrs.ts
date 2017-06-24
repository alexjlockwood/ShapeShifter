import * as collections from './_collections';

export const removeNonInheritableGroupAttrs = {
  active: true,
  type: 'perItem',
  fn: removeNonInheritableGroupAttrsFn,
  params: undefined,
};

const inheritableAttrs = collections.inheritableAttrs;
const attrsGroups = collections.attrsGroups;
const excludedAttrs = ['display', 'opacity'];

/**
 * Remove non-inheritable group's "presentation" attributes.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
function removeNonInheritableGroupAttrsFn(item) {
  if (item.isElem('g')) {
    item.eachAttr(function (attr) {
      // tslint:disable-next-line: no-bitwise
      if (~attrsGroups.presentation.indexOf(attr.name)
        // tslint:disable-next-line: no-bitwise
        && ~attrsGroups.graphicalEvent.indexOf(attr.name)
        // tslint:disable-next-line: no-bitwise
        && ~attrsGroups.core.indexOf(attr.name)
        // tslint:disable-next-line: no-bitwise
        && ~attrsGroups.conditionalProcessing.indexOf(attr.name)
        // tslint:disable-next-line: no-bitwise
        && !~excludedAttrs.indexOf(attr.name)
        // tslint:disable-next-line: no-bitwise
        && !~inheritableAttrs.indexOf(attr.name)) {
        item.removeAttr(attr.name);
      }
    });
  }
}
