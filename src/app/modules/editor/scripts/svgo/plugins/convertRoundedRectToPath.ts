import type { CustomPlugin } from 'svgo/browser';

/**
 * Converts a rounded rect to a more compact path.
 * It also allows further optimizations like
 * combining paths with similar attributes.
 *
 * @see http://www.w3.org/TR/SVG/shapes.html
 */
export const convertRoundedRectToPath: CustomPlugin = {
  name: 'convertRoundedRectToPath',
  fn: () => ({
    element: {
      enter: node => {
        const { attributes: attrs } = node;
        if (
          node.name !== 'rect' ||
          attrs.width === undefined ||
          attrs.height === undefined ||
          (attrs.rx === undefined && attrs.ry === undefined)
        ) {
          return;
        }

        const x = +(attrs.x || 0);
        const y = +(attrs.y || 0);
        const width = +attrs.width;
        const height = +attrs.height;
        const hasRx = attrs.rx !== undefined && isValidCornerRadius(+attrs.rx);
        const hasRy = attrs.ry !== undefined && isValidCornerRadius(+attrs.ry);
        let rx = +(attrs.rx || 0);
        let ry = +(attrs.ry || 0);

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
          return;
        }

        let pathData: string;
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

        node.name = 'path';
        for (const name of ['x', 'y', 'width', 'height', 'rx', 'ry']) {
          delete attrs[name];
        }
        attrs.d = pathData;
      },
    },
  }),
};

function isValidCornerRadius(val: number) {
  return !(typeof val !== 'number' || val === Infinity || val < 0);
}
