import * as bezierjs from 'bezier-js';


export default class SvgPathData {
  private string_: string;
  private length: number = 0;
  private bounds: { l: number, t: number, r: number, b: number };
  private commands_: { command: string, args: number[] }[];

  static interpolate(start, end, f) {
    if (!end || !start || !end.commands || !start.commands
      || end.commands.length !== start.commands.length) {
      // TODO: show a warning
      return [];
    }

    let interpolatedCommands = [];

    let i, j;
    for (i = 0; i < start.commands.length; i++) {
      let si = start.commands[i], ei = end.commands[i];
      if (!ei.args || !si.args || ei.args.length !== si.args.length) {
        console.warn('Incompatible path interpolation');
        return [];
      }

      let interpolatedArgs = [];
      for (j = 0; j < si.args.length; j++) {
        interpolatedArgs.push(simpleInterpolate_(si.args[j], ei.args[j], f));
      }

      interpolatedCommands.push({
        command: si.command,
        args: interpolatedArgs
      });
    }

    return new SvgPathData(interpolatedCommands);
  }

  constructor(obj) {
    this.bounds = null;

    if (obj) {
      if (typeof obj === 'string') {
        this.pathString = obj;
      } else if (Array.isArray(obj)) {
        this.commands = obj;
      } else if (obj instanceof SvgPathData) {
        this.pathString = obj.pathString;
      }
    }
  }

  get pathString() {
    return this.string_ || '';
  }

  set pathString(value) {
    this.string_ = value;
    this.commands_ = parseCommands_(value);
    let {length, bounds} = computePathLengthAndBounds_(this.commands_);
    this.length = length;
    this.bounds = bounds;
  }

  toString() {
    return this.pathString;
  }

  toJSON() {
    return this.pathString;
  }

  execute(ctx) {
    ctx.beginPath();
    this.commands_.forEach(({command, args}) => {
      if (command === '__arc__') {
        executeArc_(ctx, args);
      } else {
        ctx[command](...args);
      }
    });
  }

  get commands() {
    return this.commands_;
  }

  set commands(value) {
    this.commands_ = (value ? value.slice() : []);
    this.string_ = commandsToString_(this.commands_);
    let {length, bounds} = computePathLengthAndBounds_(this.commands_);
    this.length = length;
    this.bounds = bounds;
  }

  transform(transforms) {
    this.commands_.forEach(({ command, args }) => {
      if (command === '__arc__') {
        const start = transformPoint_({ x: args[0], y: args[1] }, transforms);
        args[0] = start.x;
        args[1] = start.y;
        const arc = transformArc_({
          rx: args[2],
          ry: args[3],
          xAxisRotation: args[4],
          largeArcFlag: args[5],
          sweepFlag: args[6],
          endX: args[7],
          endY: args[8],
        },
          transforms);
        args[2] = arc.rx;
        args[3] = arc.ry;
        args[4] = arc.xAxisRotation;
        args[5] = arc.largeArcFlag;
        args[6] = arc.sweepFlag;
        args[7] = arc.endX;
        args[8] = arc.endY;
        return;
      }

      for (let i = 0; i < args.length; i += 2) {
        let transformed = transformPoint_({ x: args[i], y: args[i + 1] }, transforms);
        args[i] = transformed.x;
        args[i + 1] = transformed.y;
      }
    });

    this.string_ = commandsToString_(this.commands_);
    let { length, bounds } = computePathLengthAndBounds_(this.commands_);
    this.length = length;
    this.bounds = bounds;
  }
}


let simpleInterpolate_ = (start, end, f) => start + (end - start) * f;


const TOKEN_ABSOLUTE_COMMAND = 1;
const TOKEN_RELATIVE_COMMAND = 2;
const TOKEN_VALUE = 3;
const TOKEN_EOF = 4;


function parseCommands_(pathString) {
  let commands = [];
  let pushCommandComplex_ = (command, ...args) => commands.push({ command, args });
  let pushCommandPoints_ = (command, ...points) => commands.push({
    command, args: points.reduce((arr, point) => arr.concat(point.x, point.y), [])
  });

  let currentPoint = { x: NaN, y: NaN };
  let currentControlPoint = null; // used for S and T commands
  let index = 0;
  let length = pathString.length;

  let tempPoint1 = { x: 0, y: 0 };
  let tempPoint2 = { x: 0, y: 0 };
  let tempPoint3 = { x: 0, y: 0 };

  let firstMove = true;
  let currentToken;

  let advanceToNextToken_ = () => {
    while (index < length) {
      let c = pathString.charAt(index);
      if ('a' <= c && c <= 'z') {
        return (currentToken = TOKEN_RELATIVE_COMMAND);
      } else if ('A' <= c && c <= 'Z') {
        return (currentToken = TOKEN_ABSOLUTE_COMMAND);
      } else if (('0' <= c && c <= '9') || c === '.' || c === '-') {
        return (currentToken = TOKEN_VALUE);
      }

      // skip unrecognized character
      ++index;
    }

    return (currentToken = TOKEN_EOF);
  };

  let consumeCommand_ = () => {
    advanceToNextToken_();
    if (currentToken !== TOKEN_RELATIVE_COMMAND && currentToken !== TOKEN_ABSOLUTE_COMMAND) {
      throw new Error('Expected command');
    }

    return pathString.charAt(index++);
  };

  let consumePoint_ = (out, relative) => {
    out.x = consumeValue_();
    out.y = consumeValue_();
    if (relative) {
      out.x += currentPoint.x;
      out.y += currentPoint.y;
    }
  };

  let consumeValue_ = () => {
    advanceToNextToken_();
    if (currentToken !== TOKEN_VALUE) {
      throw new Error('Expected value');
    }

    let start = true;
    let seenDot = false;
    let tempIndex = index;
    while (tempIndex < length) {
      let c = pathString.charAt(tempIndex);

      if (!('0' <= c && c <= '9') && (c !== '.' || seenDot) && (c !== '-' || !start) && c !== 'e') {
        // end of value
        break;
      }

      if (c === '.') {
        seenDot = true;
      }

      start = false;
      if (c === 'e') {
        start = true;
      }
      ++tempIndex;
    }

    if (tempIndex === index) {
      throw new Error('Expected value');
    }

    let str = pathString.substring(index, tempIndex);
    index = tempIndex;
    return parseFloat(str);
  };

  while (index < length) {
    let command = consumeCommand_();
    let relative = (currentToken === TOKEN_RELATIVE_COMMAND);

    switch (command) {
      case 'M':
      case 'm': {
        // move command
        let firstPoint = true;
        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative && !isNaN(currentPoint.x));
          if (firstPoint) {
            pushCommandPoints_('moveTo', tempPoint1);
            firstPoint = false;
            if (firstMove) {
              currentPoint = Object.assign({}, tempPoint1);
              firstMove = false;
            }
          } else {
            pushCommandPoints_('lineTo', tempPoint1);
          }
        }

        currentControlPoint = null;
        currentPoint = Object.assign({}, tempPoint1);
        break;
      }

      case 'C':
      case 'c': {
        // cubic curve command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          consumePoint_(tempPoint3, relative);
          pushCommandPoints_('bezierCurveTo', tempPoint1, tempPoint2, tempPoint3);

          currentControlPoint = Object.assign({}, tempPoint2);
          currentPoint = Object.assign({}, tempPoint3);
        }

        break;
      }

      case 'S':
      case 's': {
        // cubic curve command (string of curves)
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          if (currentControlPoint) {
            tempPoint3.x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            tempPoint3.y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
          } else {
            Object.assign(tempPoint3, tempPoint1);
          }
          pushCommandPoints_('bezierCurveTo', tempPoint3, tempPoint1, tempPoint2);

          currentControlPoint = Object.assign({}, tempPoint1);
          currentPoint = Object.assign({}, tempPoint2);
        }

        break;
      }

      case 'Q':
      case 'q': {
        // quadratic curve command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative);
          consumePoint_(tempPoint2, relative);
          pushCommandPoints_('quadraticCurveTo', tempPoint1, tempPoint2);

          currentControlPoint = Object.assign({}, tempPoint1);
          currentPoint = Object.assign({}, tempPoint2);
        }

        break;
      }

      case 'T':
      case 't': {
        // quadratic curve command (string of curves)
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative);
          if (currentControlPoint) {
            tempPoint2.x = currentPoint.x + (currentPoint.x - currentControlPoint.x);
            tempPoint2.y = currentPoint.y + (currentPoint.y - currentControlPoint.y);
          } else {
            Object.assign(tempPoint2, tempPoint1);
          }
          pushCommandPoints_('quadraticCurveTo', tempPoint2, tempPoint1);

          currentControlPoint = Object.assign({}, tempPoint2);
          currentPoint = Object.assign({}, tempPoint1);
        }

        break;
      }

      case 'L':
      case 'l': {
        // line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          consumePoint_(tempPoint1, relative);
          pushCommandPoints_('lineTo', tempPoint1);

          currentControlPoint = null;
          currentPoint = Object.assign({}, tempPoint1);
        }

        break;
      }

      case 'H':
      case 'h': {
        // horizontal line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          tempPoint1.x = consumeValue_();
          tempPoint1.y = currentPoint.y;
          if (relative) {
            tempPoint1.x += currentPoint.x;
          }

          pushCommandPoints_('lineTo', tempPoint1);

          currentControlPoint = null;
          currentPoint = Object.assign({}, tempPoint1);
        }
        break;
      }

      case 'A':
      case 'a': {
        // arc command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          let rx = consumeValue_();
          let ry = consumeValue_();
          let xAxisRotation = consumeValue_();
          let largeArcFlag = consumeValue_();
          let sweepFlag = consumeValue_();
          consumePoint_(tempPoint1, relative);

          pushCommandComplex_('__arc__',
            currentPoint.x, currentPoint.y,
            rx, ry,
            xAxisRotation, largeArcFlag, sweepFlag,
            tempPoint1.x, tempPoint1.y);

          // pp.addMarkerAngle(halfWay, ah - dir * Math.PI / 2);
          // pp.addMarkerAngle(tempPoint1, ah - dir * Math.PI);

          currentControlPoint = null;
          currentPoint = Object.assign({}, tempPoint1);
        }
        break;
      }

      case 'V':
      case 'v': {
        // vertical line command
        if (isNaN(currentPoint.x)) {
          throw new Error('Relative commands require current point');
        }

        while (advanceToNextToken_() === TOKEN_VALUE) {
          tempPoint1.y = consumeValue_();
          tempPoint1.x = currentPoint.x;
          if (relative) {
            tempPoint1.y += currentPoint.y;
          }
          pushCommandPoints_('lineTo', tempPoint1);

          currentControlPoint = null;
          currentPoint = Object.assign({}, tempPoint1);
        }
        break;
      }

      case 'Z':
      case 'z': {
        // close command
        pushCommandPoints_('closePath');
        break;
      }
    }
  }

  return commands;
}


function commandsToString_(commands): string {
  let tokens = [];
  commands.forEach(({command, args}) => {
    if (command === '__arc__') {
      tokens.push('A');
      tokens.splice(tokens.length, 0, args.slice(2)); // skip first two arc args
      return;
    }

    switch (command) {
      case 'moveTo': tokens.push('M'); break;
      case 'lineTo': tokens.push('L'); break;
      case 'bezierCurveTo': tokens.push('C'); break;
      case 'quadraticCurveTo': tokens.push('Q'); break;
      case 'closePath': tokens.push('Z'); break;
    }

    tokens.splice(tokens.length, 0, ...args.map(arg => Number(arg.toFixed(3)).toString()));
  });

  return tokens.join(' ');
}


function executeArc_(ctx, arcArgs) {
  let [currentPointX, currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    tempPoint1X, tempPoint1Y] = arcArgs;

  xAxisRotation *= Math.PI / 180;

  if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
    // degenerate to point
    return;
  }

  if (rx === 0 || ry === 0) {
    // degenerate to line
    ctx.lineTo(tempPoint1X, tempPoint1Y);
    return;
  }

  let bezierCoords = arcToBeziers_(currentPointX, currentPointY,
    rx, ry, xAxisRotation,
    largeArcFlag, sweepFlag,
    tempPoint1X, tempPoint1Y);

  for (let i = 0; i < bezierCoords.length; i += 8) {
    ctx.bezierCurveTo(bezierCoords[i + 2], bezierCoords[i + 3],
      bezierCoords[i + 4], bezierCoords[i + 5],
      bezierCoords[i + 6], bezierCoords[i + 7]);
  }
}


function computePathLengthAndBounds_(commands) {
  let length = 0;
  let bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };

  let expandBounds_ = (x, y) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  let expandBoundsToBezier_ = bez => {
    let bbox = bez.bbox();
    expandBounds_(bbox.x.min, bbox.y.min);
    expandBounds_(bbox.x.max, bbox.y.min);
    expandBounds_(bbox.x.min, bbox.y.max);
    expandBounds_(bbox.x.max, bbox.y.max);
  };

  let firstPoint = null;
  let currentPoint = { x: 0, y: 0 };

  let dist_ = (x1, y1, x2, y2) => {
    return Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
  };

  commands.forEach(({command, args}) => {
    switch (command) {
      case 'moveTo': {
        if (!firstPoint) {
          firstPoint = { x: args[0], y: args[1] };
        }
        currentPoint.x = args[0];
        currentPoint.y = args[1];
        expandBounds_(args[0], args[1]);
        break;
      }

      case 'lineTo': {
        length += dist_(args[0], args[1], currentPoint.x, currentPoint.y);
        currentPoint.x = args[0];
        currentPoint.y = args[1];
        expandBounds_(args[0], args[1]);
        break;
      }

      case 'closePath': {
        if (firstPoint) {
          length += dist_(firstPoint.x, firstPoint.y, currentPoint.x, currentPoint.y);
        }
        firstPoint = null;
        break;
      }

      case 'bezierCurveTo': {
        let bez = new bezierjs.Bezier(currentPoint.x, currentPoint.y, args[0], args[1],
          args[2], args[3], args[4], args[5]);
        length += bez.length();
        currentPoint.x = args[4];
        currentPoint.y = args[5];
        expandBoundsToBezier_(bez);
        break;
      }

      case 'quadraticCurveTo': {
        let bez = new bezierjs.Bezier(currentPoint.x, currentPoint.y, args[0], args[1], args[2], args[3]);
        length += bez.length();
        currentPoint.x = args[2];
        currentPoint.y = args[3];
        expandBoundsToBezier_(bez);
        break;
      }

      case '__arc__': {
        let [currentPointX, currentPointY,
          rx, ry, xAxisRotation,
          largeArcFlag, sweepFlag,
          tempPoint1X, tempPoint1Y] = args;

        xAxisRotation *= Math.PI / 180;

        if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
          // degenerate to point (0 length)
          break;
        }

        if (rx === 0 || ry === 0) {
          // degenerate to line
          length += dist_(currentPointX, currentPointY, tempPoint1X, tempPoint1Y);
          expandBounds_(tempPoint1X, tempPoint1Y);
          return;
        }

        let bezierCoords = arcToBeziers_(currentPointX, currentPointY,
          rx, ry, xAxisRotation,
          largeArcFlag, sweepFlag,
          tempPoint1X, tempPoint1Y);

        for (let i = 0; i < bezierCoords.length; i += 8) {
          let bez = new bezierjs.Bezier(currentPoint.x, currentPoint.y,
            bezierCoords[i + 2], bezierCoords[i + 3],
            bezierCoords[i + 4], bezierCoords[i + 5],
            bezierCoords[i + 6], bezierCoords[i + 7]);
          length += bez.length();
          currentPoint.x = bezierCoords[i + 6];
          currentPoint.y = bezierCoords[i + 7];
          expandBoundsToBezier_(bez);
        }
        currentPoint.x = tempPoint1X;
        currentPoint.y = tempPoint1Y;
        break;
      }
    }
  });

  return { length, bounds };
}


// Based on code from https://code.google.com/archive/p/androidsvg
function arcToBeziers_(xf, yf, rx, ry, rotate, largeArcFlag, sweepFlag, xt, yt) {
  // Sign of the radii is ignored (behaviour specified by the spec)
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  let cosAngle = Math.cos(rotate);
  let sinAngle = Math.sin(rotate);

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
  let bezierCoords = unitCircleArcToBeziers_(angleStart, angleExtent);

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
function unitCircleArcToBeziers_(angleStart, angleExtent) {
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


function transformPoint_(point, transformMatricies) {
  return transformMatricies.reduce((p, transform) => {
    const m = transform.matrix;
    return {
      // dot product
      x: m.a * p.x + m.c * p.y + m.e * 1,
      y: m.b * p.x + m.d * p.y + m.f * 1,
    };
  }, point);
}


// Code adapted from here:
// https://gist.github.com/alexjlockwood/c037140879806fb4d9820b7e70195494#file-flatten-js-L441-L547
function transformArc_(initialArc, transformMatricies) {
  const isNearZero = n => Math.abs(n) < 0.0000000000000001;
  return transformMatricies.reduce((arc, transform) => {
    let {rx, ry, xAxisRotation, largeArcFlag, sweepFlag, endX, endY} = arc;

    xAxisRotation = xAxisRotation * Math.PI / 180;

    const s = Math.sin(xAxisRotation);
    const c = Math.cos(xAxisRotation);

    // Matrix representation of transformed ellipse.
    let m = [];

    // Build ellipse representation matrix (unit circle transformation).
    // The 2x2 matrix multiplication with the upper 2x2 of a_mat is inlined.
    const matrix = transform.matrix;
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
    const end = transformPoint_({ x: endX, y: endY }, [transform]);

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
