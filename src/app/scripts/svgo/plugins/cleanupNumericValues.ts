/* tslint:disable */

import * as tools from './_tools';

export const cleanupNumericValues = {
  active: true,
  type: 'perItem',
  fn: cleanupNumericValuesFn,
  params: {
    floatPrecision: 10,
    leadingZero: true,
    defaultPx: true,
    convertToPx: true
  },
};

const regNumericValues = /^([\-+]?\d*\.?\d+([eE][\-+]?\d+)?)(px|pt|pc|mm|cm|m|in|ft|em|ex|%)?$/;
const removeLeadingZero = tools.removeLeadingZero;
const absoluteLengths = { // relative to px
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  in: 96,
  pt: 4 / 3,
  pc: 16
};

/**
 * Round numeric values to the fixed precision,
 * remove default 'px' units.
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
function cleanupNumericValuesFn(item, params) {

  if (item.isElem()) {

    var match;

    item.eachAttr(function (attr) {
      match = attr.value.match(regNumericValues);

      // if attribute value matches regNumericValues
      if (match) {
        // round it to the fixed precision
        var num = +(+match[1]).toFixed(params.floatPrecision),
          units = match[3] || '';

        // convert absolute values to pixels
        if (params.convertToPx && units && (units in absoluteLengths)) {
          var pxNum = +(absoluteLengths[units] * match[1]).toFixed(params.floatPrecision);

          if (String(pxNum).length < match[0].length)
            num = pxNum,
              units = 'px';
        }

        // and remove leading zero
        if (params.leadingZero) {
          num = removeLeadingZero(num);
        }

        // remove default 'px' units
        if (params.defaultPx && units === 'px') {
          units = '';
        }

        attr.value = num + units;
      }
    });

  }

};
