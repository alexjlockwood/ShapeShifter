/* tslint:disable */

// export function intersectArrays(a, b) {
//   return a.filter(function (n) {
//     return b.indexOf(n) > -1;
//   });
// };

export function cleanupOutData(data, params) {

  var str = '',
    delimiter,
    prev;

  data.forEach(function (item, i) {

    // space delimiter by default
    delimiter = ' ';

    // no extra space in front of first number
    if (i === 0) {
      delimiter = '';
    }

    // remove floating-point numbers leading zeros
    // 0.5 → .5
    // -0.5 → -.5
    if (params.leadingZero) {
      item = removeLeadingZero(item);
    }

    // no extra space in front of negative number or
    // in front of a floating number if a previous number is floating too
    if (
      params.negativeExtraSpace &&
      (item < 0 ||
        (String(item).charCodeAt(0) == 46 && prev % 1 !== 0)
      )
    ) {
      delimiter = '';
    }

    // save prev item value
    prev = item;

    str += delimiter + item;

  });

  return str;

};

/**
 * Remove floating-point numbers leading zero.
 *
 * @example
 * 0.5 → .5
 *
 * @example
 * -0.5 → -.5
 *
 * @param {Float} num input number
 *
 * @return {String} output number as string
 */
export function removeLeadingZero(num) {
  var strNum = num.toString();

  if (0 < num && num < 1 && strNum.charCodeAt(0) == 48) {
    strNum = strNum.slice(1);
  } else if (-1 < num && num < 0 && strNum.charCodeAt(1) == 48) {
    strNum = strNum.charAt(0) + strNum.slice(2);
  }

  return strNum;

};
