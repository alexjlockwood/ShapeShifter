/* tslint:disable */

import * as collections from './_collections';
import { Plugin } from './Plugin';

export const removeEditorsNSData: Plugin = {
  type: 'perItem',
  fn: removeEditorsNSDataFn,
};

var editorNamespaces = collections.editorNamespaces,
  prefixes = [];

/**
 * Remove editors namespaces, elements and attributes.
 *
 * @example
 * <svg xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd">
 * <sodipodi:namedview/>
 * <path sodipodi:nodetypes="cccc"/>
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
export function removeEditorsNSDataFn(item, params = { additionalNamespaces: [] }) {
  if (Array.isArray(params.additionalNamespaces)) {
    editorNamespaces = editorNamespaces.concat(params.additionalNamespaces);
  }
  if (item.elem) {
    if (item.isElem('svg')) {
      item.eachAttr(function (attr) {
        if (attr.prefix === 'xmlns' && editorNamespaces.indexOf(attr.value) > -1) {
          prefixes.push(attr.local);
          // <svg xmlns:sodipodi="">
          item.removeAttr(attr.name);
        }
      });
    }

    // <* sodipodi:*="">
    item.eachAttr(function (attr) {
      if (prefixes.indexOf(attr.prefix) > -1) {
        item.removeAttr(attr.name);
      }
    });

    // <sodipodi:*>
    if (prefixes.indexOf(item.prefix) > -1) {
      return false;
    }
  }
  return undefined;
}
