/* tslint:disable */

export const convertShapeToPath = {
  active: true,
  type: 'perItem',
  fn: convertShapeToPathFn,
  params: undefined,
};

const none = { value: 0 };
const regNumber = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

/**
 * Converts basic shape to more compact path.
 * It also allows further optimizations like
 * combining paths with similar attributes.
 *
 * @see http://www.w3.org/TR/SVG/shapes.html
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
function convertShapeToPathFn(item) {

  if (
    item.isElem('rect') &&
    item.hasAttr('width') &&
    item.hasAttr('height') &&
    !item.hasAttr('rx') &&
    !item.hasAttr('ry')
  ) {

    var x = +(item.attr('x') || none).value,
      y = +(item.attr('y') || none).value,
      width = +item.attr('width').value,
      height = +item.attr('height').value;

    // Values like '100%' compute to NaN, thus running after
    // cleanupNumericValues when 'px' units has already been removed.
    // TODO: Calculate sizes from % and non-px units if possible.
    if (isNaN(x - y + width - height)) return undefined;

    var pathData =
      'M' + x + ' ' + y +
      'H' + (x + width) +
      'V' + (y + height) +
      'H' + x +
      'z';

    item.addAttr({
      name: 'd',
      value: pathData,
      prefix: '',
      local: 'd'
    });

    item.renameElem('path')
      .removeAttr(['x', 'y', 'width', 'height']);

  } else if (item.isElem('line')) {

    var x1 = +(item.attr('x1') || none).value,
      y1 = +(item.attr('y1') || none).value,
      x2 = +(item.attr('x2') || none).value,
      y2 = +(item.attr('y2') || none).value;
    if (isNaN(x1 - y1 + x2 - y2)) return undefined;

    item.addAttr({
      name: 'd',
      value: 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2,
      prefix: '',
      local: 'd'
    });

    item.renameElem('path')
      .removeAttr(['x1', 'y1', 'x2', 'y2']);

  } else if ((
    item.isElem('polyline') ||
    item.isElem('polygon')
  ) &&
    item.hasAttr('points')
  ) {

    var coords = (item.attr('points').value.match(regNumber) || []).map(Number);
    if (coords.length < 4) return false;

    item.addAttr({
      name: 'd',
      value: 'M' + coords.slice(0, 2).join(' ') +
      'L' + coords.slice(2).join(' ') +
      (item.isElem('polygon') ? 'z' : ''),
      prefix: '',
      local: 'd'
    });

    item.renameElem('path')
      .removeAttr('points');

  } else if (item.isElem('circle')) {
    var cx = +(item.attr('cx') || none).value,
      cy = +(item.attr('cy') || none).value,
      r = +(item.attr('r') || none).value;
    if (isNaN(cx - cy + r)) return undefined;

    item.addAttr({
      name: 'd',
      value: `M ${cx},${cy - r} A ${r} ${r} 0 1 0 ${cx},${cy + r} `
      + `A ${r} ${r} 0 1 0 ${cx},${cy - r} Z`,
      prefix: '',
      local: 'd'
    });

    item.renameElem('path').removeAttr(['cx', 'cy', 'r']);

  } else if (item.isElem('ellipse')) {
    var cx = +(item.attr('cx') || none).value,
      cy = +(item.attr('cy') || none).value,
      rx = +(item.attr('rx') || none).value,
      ry = +(item.attr('ry') || none).value;
    if (isNaN(cx - cy + rx - ry)) return undefined;

    item.addAttr({
      name: 'd',
      value: `M ${cx},${cy - ry} A ${rx} ${ry} 0 1 0 ${cx},${cy + ry} `
      + `A ${rx} ${ry} 0 1 0 ${cx},${cy - ry} Z`,
      prefix: '',
      local: 'd'
    });

    item.renameElem('path').removeAttr(['cx', 'cy', 'rx', 'ry']);
  }

  return undefined;
};
