/* tslint:disable */

import * as collections from './_collections';

export const removeUselessStrokeAndFill = {
  active: true,
  type: 'perItem',
  fn: removeUselessStrokeAndFillFn,
  params: {
    stroke: true,
    fill: true,
    removeNone: true,
    hasStyleOrScript: false
  },
};

const shape = collections.elemsGroups.shape;
const regStrokeProps = /^stroke/;
const regFillProps = /^fill-/;
const styleOrScript = ['style', 'script'];

/**
 * Remove useless stroke and fill attrs.
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
function removeUselessStrokeAndFillFn(item, params) {
  if (item.isElem(styleOrScript)) {
    params.hasStyleOrScript = true;
  }

  if (!params.hasStyleOrScript && item.isElem(shape) && !item.computedAttr('id')) {
    const stroke = params.stroke && item.computedAttr('stroke');
    const fill = params.fill && !item.computedAttr('fill', 'none');

    // remove stroke*
    if (params.stroke
      && (!stroke
        || stroke == 'none'
        || item.computedAttr('stroke-opacity', '0')
        || item.computedAttr('stroke-width', '0'))) {
      const parentStroke = item.parentNode.computedAttr('stroke');
      const declineStroke = parentStroke && parentStroke != 'none';

      item.eachAttr(function (attr) {
        if (regStrokeProps.test(attr.name)) {
          item.removeAttr(attr.name);
        }
      });

      if (declineStroke) {
        item.addAttr({
          name: 'stroke',
          value: 'none',
          prefix: '',
          local: 'stroke'
        });
      }
    }

    // remove fill*
    if (params.fill && (!fill || item.computedAttr('fill-opacity', '0'))) {
      item.eachAttr(function (attr) {
        if (regFillProps.test(attr.name)) {
          item.removeAttr(attr.name);
        }
      });
      if (fill) {
        if (item.hasAttr('fill')) {
          item.attr('fill').value = 'none';
        } else {
          item.addAttr({
            name: 'fill',
            value: 'none',
            prefix: '',
            local: 'fill'
          });
        }
      }
    }
    if (params.removeNone
      && (!stroke || item.hasAttr('stroke') && item.attr('stroke').value == 'none')
      && (!fill || item.hasAttr('fill') && item.attr('fill').value == 'none')) {
      return false;
    }
  }
  return undefined;
}
