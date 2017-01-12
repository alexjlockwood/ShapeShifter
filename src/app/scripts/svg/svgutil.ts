import { Point, Matrix, MathUtil } from '../common';

/** Draws an elliptical arc on the specified canvas context. */
export function executeArc(ctx: CanvasRenderingContext2D, arcArgs) {
  let [currentPointX, currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    tempPoint1X, tempPoint1Y] = arcArgs;

  if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
    // degenerate to point
    return;
  }

  if (rx === 0 || ry === 0) {
    // degenerate to line
    ctx.lineTo(tempPoint1X, tempPoint1Y);
    return;
  }

  let bezierCoords = arcToBeziers(currentPointX, currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    tempPoint1X, tempPoint1Y);

  for (let i = 0; i < bezierCoords.length; i += 8) {
    ctx.bezierCurveTo(
      bezierCoords[i + 2], bezierCoords[i + 3],
      bezierCoords[i + 4], bezierCoords[i + 5],
      bezierCoords[i + 6], bezierCoords[i + 7]);
  }
}

/** Estimates an elliptical arc as a sequence of bezier curves. */
export function arcToBeziers(xf, yf, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, xt, yt) {
  // Sign of the radii is ignored (behaviour specified by the spec)
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  xAxisRotation = xAxisRotation * Math.PI / 180;
  let cosAngle = Math.cos(xAxisRotation);
  let sinAngle = Math.sin(xAxisRotation);

  // We simplify the calculations by transforming the arc so that the origin is at the
  // midpoint calculated above followed by a rotation to line up the coordinate axes
  // with the axes of the ellipse.

  // Compute the midpoint of the line between the current and the end point
  let dx2 = (xf - xt) / 2;
  let dy2 = (yf - yt) / 2;

  // Step 1 : Compute (x1', y1') - the transformed start point
  let x1 = (cosAngle * dx2 + sinAngle * dy2);
  let y1 = (-sinAngle * dx2 + cosAngle * dy2);

  let rx_sq = rx * rx;
  let ry_sq = ry * ry;
  let x1_sq = x1 * x1;
  let y1_sq = y1 * y1;

  // Check that radii are large enough.
  // If they are not, the spec says to scale them up so they are.
  // This is to compensate for potential rounding errors/differences between SVG implementations.
  let radiiCheck = x1_sq / rx_sq + y1_sq / ry_sq;
  if (radiiCheck > 1) {
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
    rx_sq = rx * rx;
    ry_sq = ry * ry;
  }

  // Step 2 : Compute (cx1, cy1) - the transformed centre point
  let sign = (largeArcFlag === sweepFlag) ? -1 : 1;
  let sq = ((rx_sq * ry_sq) - (rx_sq * y1_sq) - (ry_sq * x1_sq)) / ((rx_sq * y1_sq) + (ry_sq * x1_sq));
  sq = (sq < 0) ? 0 : sq;
  let coef = (sign * Math.sqrt(sq));
  let cx1 = coef * ((rx * y1) / ry);
  let cy1 = coef * -((ry * x1) / rx);

  // Step 3 : Compute (cx, cy) from (cx1, cy1)
  let sx2 = (xf + xt) / 2;
  let sy2 = (yf + yt) / 2;
  let cx = sx2 + (cosAngle * cx1 - sinAngle * cy1);
  let cy = sy2 + (sinAngle * cx1 + cosAngle * cy1);

  // Step 4 : Compute the angleStart (angle1) and the angleExtent (dangle)
  let ux = (x1 - cx1) / rx;
  let uy = (y1 - cy1) / ry;
  let vx = (-x1 - cx1) / rx;
  let vy = (-y1 - cy1) / ry;
  let p, n;

  // Compute the angle start
  n = Math.sqrt((ux * ux) + (uy * uy));
  p = ux; // (1 * ux) + (0 * uy)
  sign = (uy < 0) ? -1 : 1;
  let angleStart = (sign * Math.acos(p / n)) * 180 / Math.PI;

  // Compute the angle extent
  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  p = ux * vx + uy * vy;
  sign = (ux * vy - uy * vx < 0) ? -1 : 1;
  let angleExtent = (sign * Math.acos(p / n)) * 180 / Math.PI;
  if (!sweepFlag && angleExtent > 0) {
    angleExtent -= 360;
  } else if (sweepFlag && angleExtent < 0) {
    angleExtent += 360;
  }

  angleExtent %= 360;
  angleStart %= 360;

  // Many elliptical arc implementations including the Java2D and Android ones, only
  // support arcs that are axis aligned.  Therefore we need to substitute the arc
  // with bezier curves.  The following method call will generate the beziers for
  // a unit circle that covers the arc angles we want.
  let bezierCoords = unitCircleArcToBeziers(angleStart, angleExtent);

  // Calculate a transformation matrix that will move and scale these bezier points to the correct location.
  // translate(cx, cy) --> rotate(rotate) --> scale(rx, ry)
  for (let i = 0; i < bezierCoords.length; i += 2) {
    // dot product
    let x = bezierCoords[i];
    let y = bezierCoords[i + 1];
    bezierCoords[i] =
      cosAngle * rx * x +
      -sinAngle * ry * y +
      cx;

    bezierCoords[i + 1] =
      sinAngle * rx * x +
      cosAngle * ry * y +
      cy;
  }

  // The last point in the bezier set should match exactly the last coord pair in the arc (ie: x,y). But
  // considering all the mathematical manipulation we have been doing, it is bound to be off by a tiny
  // fraction. Experiments show that it can be up to around 0.00002.  So why don't we just set it to
  // exactly what it ought to be.
  bezierCoords[bezierCoords.length - 2] = xt;
  bezierCoords[bezierCoords.length - 1] = yt;
  return bezierCoords;
}


/*
* Generate the control points and endpoints for a set of bezier curves that match
* a circular arc starting from angle 'angleStart' and sweep the angle 'angleExtent'.
* The circle the arc follows will be centred on (0,0) and have a radius of 1.0.
*
* Each bezier can cover no more than 90 degrees, so the arc will be divided evenly
* into a maximum of four curves.
*
* The resulting control points will later be scaled and rotated to match the final
* arc required.
*
* The returned array has the format [x0,y0, x1,y1,...].
*/
function unitCircleArcToBeziers(angleStart: number, angleExtent: number): number[] {
  let numSegments = Math.ceil(Math.abs(angleExtent) / 90);

  angleStart = angleStart * Math.PI / 180;
  angleExtent = angleExtent * Math.PI / 180;

  let angleIncrement = angleExtent / numSegments;

  // The length of each control point vector is given by the following formula.
  let controlLength = 4 / 3 * Math.sin(angleIncrement / 2) / (1 + Math.cos(angleIncrement / 2));

  let coords = new Array(numSegments * 8);
  let pos = 0;

  for (let i = 0; i < numSegments; i++) {
    let angle = angleStart + i * angleIncrement;

    // Calculate the control vector at this angle
    let dx = Math.cos(angle);
    let dy = Math.sin(angle);

    // First point
    coords[pos++] = dx;
    coords[pos++] = dy;

    // First control point
    coords[pos++] = (dx - controlLength * dy);
    coords[pos++] = (dy + controlLength * dx);

    // Second control point
    angle += angleIncrement;
    dx = Math.cos(angle);
    dy = Math.sin(angle);

    coords[pos++] = (dx + controlLength * dy);
    coords[pos++] = (dy - controlLength * dx);

    // Endpoint of bezier
    coords[pos++] = dx;
    coords[pos++] = dy;
  }

  return coords;
}


// Code adapted from here:
// https://gist.github.com/alexjlockwood/c037140879806fb4d9820b7e70195494#file-flatten-js-L441-L547
export function transformArc(initialArc, transformMatrices: Matrix[]) {
  const isNearZero = n => Math.abs(n) < 0.0000000000000001;
  return transformMatrices.reduce((arc, matrix) => {
    let {rx, ry, xAxisRotation, largeArcFlag, sweepFlag, endX, endY} = arc;

    xAxisRotation = xAxisRotation * Math.PI / 180;

    const s = Math.sin(xAxisRotation);
    const c = Math.cos(xAxisRotation);

    // Matrix representation of transformed ellipse.
    let m = [];

    // Build ellipse representation matrix (unit circle transformation).
    // The 2x2 matrix multiplication with the upper 2x2 of a_mat is inlined.
    m[0] = matrix.a * +rx * c + matrix.c * rx * s;
    m[1] = matrix.b * +rx * c + matrix.d * rx * s;
    m[2] = matrix.a * -ry * s + matrix.c * ry * c;
    m[3] = matrix.b * -ry * s + matrix.d * ry * c;

    // To implict equation (centered).
    const A = (m[0] * m[0]) + (m[2] * m[2]);
    const C = (m[1] * m[1]) + (m[3] * m[3]);
    const B = (m[0] * m[1] + m[2] * m[3]) * 2.0;

    // Precalculate distance A to C.
    const ac = A - C;

    // Convert implicit equation to angle and halfaxis.
    let A2, C2;
    if (isNearZero(B)) {
      xAxisRotation = 0;
      A2 = A;
      C2 = C;
    } else {
      if (isNearZero(ac)) {
        A2 = A + B * 0.5;
        C2 = A - B * 0.5;
        xAxisRotation = Math.PI / 4.0;
      } else {
        // Precalculate radical.
        let K = 1 + B * B / (ac * ac);

        // Clamp (precision issues might need this... not likely, but better safe than sorry).
        K = K < 0 ? 0 : Math.sqrt(K);

        A2 = 0.5 * (A + C + K * ac);
        C2 = 0.5 * (A + C - K * ac);
        xAxisRotation = 0.5 * Math.atan2(B, ac);
      }
    }

    // This can get slightly below zero due to rounding issues.
    // It's safe to clamp to zero in this case (this yields a zero length halfaxis).
    A2 = A2 < 0 ? 0 : Math.sqrt(A2);
    C2 = C2 < 0 ? 0 : Math.sqrt(C2);

    // Now A2 and C2 are half-axis.
    if (ac <= 0) {
      ry = A2;
      rx = C2;
    } else {
      ry = C2;
      rx = A2;
    }

    // If the transformation matrix contain a mirror-component
    // winding order of the ellise needs to be changed.
    if ((matrix.a * matrix.d) - (matrix.b * matrix.c) < 0) {
      sweepFlag = sweepFlag ? 0 : 1;
    }

    // Finally, transform arc endpoint. This takes care about the
    // translational part which we ignored at the whole math-showdown above.
    const end = MathUtil.transform({ x: endX, y: endY }, matrix);

    xAxisRotation = xAxisRotation * 180 / Math.PI;

    return {
      rx,
      ry,
      xAxisRotation,
      largeArcFlag,
      sweepFlag,
      endX: end.x,
      endY: end.y,
    };
  }, initialArc);
}
