interface EllipticalArc {
  startX?: number;
  startY?: number;
  rx: number;
  ry: number;
  xAxisRotation: number;
  largeArcFlag: number;
  sweepFlag: number;
  endX: number;
  endY: number;
}

/** Estimates an elliptical arc as a sequence of bezier curves. */
export function arcToBeziers(arc: EllipticalArc) {
  const { startX: xf, startY: yf, largeArcFlag, sweepFlag, endX: xt, endY: yt } = arc;
  let rx = arc.rx;
  let ry = arc.ry;
  let xAxisRotation = arc.xAxisRotation;

  // Sign of the radii is ignored (behaviour specified by the spec)
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  xAxisRotation = xAxisRotation * Math.PI / 180;
  const cosAngle = Math.cos(xAxisRotation);
  const sinAngle = Math.sin(xAxisRotation);

  // We simplify the calculations by transforming the arc so that the origin is at the
  // midpoint calculated above followed by a rotation to line up the coordinate axes
  // with the axes of the ellipse.

  // Compute the midpoint of the line between the current and the end point
  const dx2 = (xf - xt) / 2;
  const dy2 = (yf - yt) / 2;

  // Step 1 : Compute (x1', y1') - the transformed start point
  const x1 = cosAngle * dx2 + sinAngle * dy2;
  const y1 = -sinAngle * dx2 + cosAngle * dy2;

  let rx_sq = rx * rx;
  let ry_sq = ry * ry;
  const x1_sq = x1 * x1;
  const y1_sq = y1 * y1;

  // Check that radii are large enough.
  // If they are not, the spec says to scale them up so they are.
  // This is to compensate for potential rounding errors/differences between SVG implementations.
  const radiiCheck = x1_sq / rx_sq + y1_sq / ry_sq;
  if (radiiCheck > 1) {
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
    rx_sq = rx * rx;
    ry_sq = ry * ry;
  }

  // Step 2 : Compute (cx1, cy1) - the transformed centre point
  let sign = largeArcFlag === sweepFlag ? -1 : 1;
  let sq = (rx_sq * ry_sq - rx_sq * y1_sq - ry_sq * x1_sq) / (rx_sq * y1_sq + ry_sq * x1_sq);
  sq = sq < 0 ? 0 : sq;
  const coef = sign * Math.sqrt(sq);
  const cx1 = coef * (rx * y1 / ry);
  const cy1 = coef * -(ry * x1 / rx);

  // Step 3 : Compute (cx, cy) from (cx1, cy1)
  const sx2 = (xf + xt) / 2;
  const sy2 = (yf + yt) / 2;
  const cx = sx2 + (cosAngle * cx1 - sinAngle * cy1);
  const cy = sy2 + (sinAngle * cx1 + cosAngle * cy1);

  // Step 4 : Compute the angleStart (angle1) and the angleExtent (dangle)
  const ux = (x1 - cx1) / rx;
  const uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx;
  const vy = (-y1 - cy1) / ry;
  let p, n;

  // Compute the angle start
  n = Math.sqrt(ux * ux + uy * uy);
  p = ux; // (1 * ux) + (0 * uy)
  sign = uy < 0 ? -1 : 1;
  let angleStart = sign * Math.acos(p / n) * 180 / Math.PI;

  // Compute the angle extent
  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  p = ux * vx + uy * vy;
  sign = ux * vy - uy * vx < 0 ? -1 : 1;
  let angleExtent = sign * Math.acos(p / n) * 180 / Math.PI;
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
  const bezierCoords = unitCircleArcToBeziers(angleStart, angleExtent);

  // Calculate a transformation matrix that will move and scale these bezier points to the correct location.
  // translate(cx, cy) --> rotate(rotate) --> scale(rx, ry)
  for (let i = 0; i < bezierCoords.length; i += 2) {
    // dot product
    const x = bezierCoords[i];
    const y = bezierCoords[i + 1];
    bezierCoords[i] = cosAngle * rx * x + -sinAngle * ry * y + cx;

    bezierCoords[i + 1] = sinAngle * rx * x + cosAngle * ry * y + cy;
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
  const numSegments = Math.ceil(Math.abs(angleExtent) / 90);

  angleStart = angleStart * Math.PI / 180;
  angleExtent = angleExtent * Math.PI / 180;

  const angleIncrement = angleExtent / numSegments;

  // The length of each control point vector is given by the following formula.
  const controlLength = 4 / 3 * Math.sin(angleIncrement / 2) / (1 + Math.cos(angleIncrement / 2));

  const coords = new Array(numSegments * 8);
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
    coords[pos++] = dx - controlLength * dy;
    coords[pos++] = dy + controlLength * dx;

    // Second control point
    angle += angleIncrement;
    dx = Math.cos(angle);
    dy = Math.sin(angle);

    coords[pos++] = dx + controlLength * dy;
    coords[pos++] = dy - controlLength * dx;

    // Endpoint of bezier
    coords[pos++] = dx;
    coords[pos++] = dy;
  }

  return coords;
}
