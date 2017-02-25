/* tslint:disable */

import * as collections from './_collections';
import { Plugin } from './Plugin';

export const moveGroupAttrsToElems: Plugin = {
  type: 'perItem',
  fn: moveGroupAttrsToElemsFn,
};

const pathElems = collections.pathElems.concat(['g', 'text']);
const referencesProps = collections.referencesProps;

/**
 * Move group attrs to the content elements.
 *
 * @example
 * <g transform="scale(2)">
 *     <path transform="rotate(45)" d="M0,0 L10,20"/>
 *     <path transform="translate(10, 20)" d="M0,10 L20,30"/>
 * </g>
 *                          ⬇
 * <g>
 *     <path transform="scale(2) rotate(45)" d="M0,0 L10,20"/>
 *     <path transform="scale(2) translate(10, 20)" d="M0,10 L20,30"/>
 * </g>
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 */
export function moveGroupAttrsToElemsFn(item) {

  // move group transform attr to content's pathElems
  if (
    item.isElem('g') &&
    item.hasAttr('transform') &&
    !item.isEmpty() &&
    !item.someAttr(function (attr) {
      return ~referencesProps.indexOf(attr.name) && ~attr.value.indexOf('url(');
    }) &&
    item.content.every(function (inner) {
      return inner.isElem(pathElems) && !inner.hasAttr('id');
    })
  ) {
    item.content.forEach(function (inner) {
      var attr = item.attr('transform');
      if (inner.hasAttr('transform')) {
        inner.attr('transform').value = attr.value + ' ' + inner.attr('transform').value;
      } else {
        inner.addAttr({
          'name': attr.name,
          'local': attr.local,
          'prefix': attr.prefix,
          'value': attr.value
        });
      }
    });

    item.removeAttr('transform');
  }

};
