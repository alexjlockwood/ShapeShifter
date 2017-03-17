/* tslint:disable */

export const convertShapeToPath = {
  active: true,
  type: 'perItem',
  fn: convertShapeToPathFn,
  params: undefined,
};

const NONE = { value: 0 };
const REG_NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

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

  if (item.isElem('rect') && item.hasAttr('width') && item.hasAttr('height')) {
    const isValidFn = val => {
      return !(typeof (val) !== 'number' || val == Infinity || val < 0);
    }

    const x = +(item.attr('x') || NONE).value;
    const y = +(item.attr('y') || NONE).value;
    const width = +item.attr('width').value;
    const height = +item.attr('height').value;
    const hasRx = item.hasAttr('rx') && isValidFn(+item.attr('rx').value);
    const hasRy = item.hasAttr('ry') && isValidFn(+item.attr('ry').value);
    let rx = +(item.attr('rx') || NONE).value;
    let ry = +(item.attr('ry') || NONE).value;

    if (!hasRx && !hasRy) {
      // If neither 'rx' nor 'ry' are properly specified, then set both rx and ry to 0.
      rx = ry = 0;
    } else if (hasRx && !hasRy) {
      // Otherwise, if a properly specified value is provided for 'rx', but not for 'ry',
      // then set both rx and ry to the value of 'rx'.
      ry = rx;
    } else if (!hasRx && hasRy) {
      // Otherwise, if a properly specified value is provided for 'ry', but not for 'rx',
      // then set both rx and ry to the value of 'ry'.
      rx = ry;
    } else {
      // If rx is greater than half of 'width', then set rx to half of 'width'.
      if (rx > width / 2) {
        rx = width / 2;
      }
      // If ry is greater than half of 'height', then set ry to half of 'height'.
      if (ry > height / 2) {
        ry = height / 2;
      }
    }

    let pathData;
    if (!rx && !ry) {
      pathData = `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
    } else {
      pathData = `M ${x + rx} ${y} `
        + `H ${x + width - rx} `
        + `A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry} `
        + `V ${y + height - ry} `
        + `A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height} `
        + `H ${x + rx} `
        + `A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry} `
        + `V ${y + ry} `
        + `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`;
    }

    // Values like '100%' compute to NaN, thus running after
    // cleanupNumericValues when 'px' units has already been removed.
    // TODO: Calculate sizes from % and non-px units if possible.
    if (isNaN(x - y + width - height + rx - ry)) {
      return undefined;
    }
    item.addAttr({
      name: 'd',
      value: pathData,
      prefix: '',
      local: 'd',
    });
    item.renameElem('path').removeAttr(['x', 'y', 'width', 'height', 'rx', 'ry']);

  } else if (item.isElem('line')) {

    const x1 = +(item.attr('x1') || NONE).value;
    const y1 = +(item.attr('y1') || NONE).value;
    const x2 = +(item.attr('x2') || NONE).value;
    const y2 = +(item.attr('y2') || NONE).value;
    if (isNaN(x1 - y1 + x2 - y2)) {
      return undefined;
    }
    item.addAttr({
      name: 'd',
      value: `M ${x1} ${y1} L ${x2} ${y2}`,
      prefix: '',
      local: 'd',
    });
    item.renameElem('path').removeAttr(['x1', 'y1', 'x2', 'y2']);

  } else if ((item.isElem('polyline') || item.isElem('polygon')) && item.hasAttr('points')) {

    const coords = (item.attr('points').value.match(REG_NUMBER) || []).map(Number);
    if (coords.length < 4) {
      return false;
    }
    const pathData =
      'M' + coords.slice(0, 2).join(' ')
      + 'L' + coords.slice(2).join(' ')
      + (item.isElem('polygon') ? 'z' : '');
    item.addAttr({
      name: 'd',
      value: pathData,
      prefix: '',
      local: 'd',
    });
    item.renameElem('path').removeAttr('points');

  } else if (item.isElem('circle')) {

    const cx = +(item.attr('cx') || NONE).value;
    const cy = +(item.attr('cy') || NONE).value;
    const r = +(item.attr('r') || NONE).value;
    if (isNaN(cx - cy + r)) {
      return undefined;
    }
    const pathData =
      `M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`;
    item.addAttr({
      name: 'd',
      value: pathData,
      prefix: '',
      local: 'd',
    });
    item.renameElem('path').removeAttr(['cx', 'cy', 'r']);

  } else if (item.isElem('ellipse')) {

    const cx = +(item.attr('cx') || NONE).value;
    const cy = +(item.attr('cy') || NONE).value;
    const rx = +(item.attr('rx') || NONE).value;
    const ry = +(item.attr('ry') || NONE).value;
    if (isNaN(cx - cy + rx - ry)) {
      return undefined;
    }
    const pathData =
      `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 0 ${cx} ${cy + ry} A ${rx} ${ry} 0 1 0 ${cx} ${cy - ry} Z`
    item.addAttr({
      name: 'd',
      value: pathData,
      prefix: '',
      local: 'd',
    });
    item.renameElem('path').removeAttr(['cx', 'cy', 'rx', 'ry']);
  }

  return undefined;
};
