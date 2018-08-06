export const convertRoundedRectToPath = {
  active: true,
  type: 'perItem',
  fn: convertRoundedRectToPathFn,
  params: undefined as any,
};

const none = { value: 0 };

/**
 * Converts a rounded rect to a more compact path.
 * It also allows further optimizations like
 * combining paths with similar attributes.
 *
 * @see http://www.w3.org/TR/SVG/shapes.html
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
function convertRoundedRectToPathFn(item: any, params: any): any {
  if (
    !item.isElem('rect') ||
    !item.hasAttr('width') ||
    !item.hasAttr('height') ||
    !(item.hasAttr('rx') || item.hasAttr('ry'))
  ) {
    return undefined;
  }

  const x = +(item.attr('x') || none).value;
  const y = +(item.attr('y') || none).value;
  const width = +item.attr('width').value;
  const height = +item.attr('height').value;
  const hasRx = item.hasAttr('rx') && isValidCornerRadius(+item.attr('rx').value);
  const hasRy = item.hasAttr('ry') && isValidCornerRadius(+item.attr('ry').value);
  let rx = +(item.attr('rx') || none).value;
  let ry = +(item.attr('ry') || none).value;

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

  // Values like '100%' compute to NaN, thus running after
  // cleanupNumericValues when 'px' units has already been removed.
  // TODO: Calculate sizes from % and non-px units if possible.
  if (isNaN(x - y + width - height + rx - ry)) {
    return undefined;
  }

  let pathData;
  if (!rx && !ry) {
    pathData = `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
  } else {
    pathData =
      `M ${x + rx} ${y} ` +
      `H ${x + width - rx} ` +
      `A ${rx} ${ry} 0 0 1 ${x + width} ${y + ry} ` +
      `V ${y + height - ry} ` +
      `A ${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height} ` +
      `H ${x + rx} ` +
      `A ${rx} ${ry} 0 0 1 ${x} ${y + height - ry} ` +
      `V ${y + ry} ` +
      `A ${rx} ${ry} 0 0 1 ${x + rx} ${y}`;
  }

  item.addAttr({ name: 'd', value: pathData, prefix: '', local: 'd' });
  item.renameElem('path').removeAttr(['x', 'y', 'width', 'height', 'rx', 'ry']);
}

function isValidCornerRadius(val: any) {
  return !(typeof val !== 'number' || val === Infinity || val < 0);
}
