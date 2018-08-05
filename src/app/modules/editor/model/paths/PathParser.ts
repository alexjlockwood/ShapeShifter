import { Point } from 'app/modules/editor/scripts/common';

import { Command } from './Command';

/**
 * Takes an SVG path string (i.e. the text specified in the path's 'd' attribute) and returns
 * list of Commands that represent the SVG path's individual sequence of instructions.
 * Arcs are converted to bezier curves because they make life too complicated. :D
 */
export function parseCommands(pathData: string) {
  if (!pathData) {
    pathData = '';
  }
  pathData = pathData.trim();
  let start = 0;
  let end = 1;

  const nodes: Array<{ readonly type: string; readonly params: number[] }> = [];
  while (end < pathData.length) {
    end = nextStart(pathData, end);
    const s = pathData.substring(start, end).trim();
    if (s.length > 0) {
      const val = getFloats(s);
      nodes.push({ type: s.charAt(0), params: val });
    }
    start = end;
    end++;
  }
  if (end - start === 1 && start < pathData.length) {
    nodes.push({ type: pathData.charAt(start), params: [] });
  }
  const current: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  let previousCommand = 'm';
  const builder = new CommandsBuilder();
  for (const n of nodes) {
    addCommand(builder, current, previousCommand, n.type, n.params);
    previousCommand = n.type;
  }
  return builder.toCommands();
}

function nextStart(s: string, end: number) {
  while (end < s.length) {
    const c = s.charAt(end);
    // Note that 'e' or 'E' are not valid path commands, but could be used for floating
    // point numbers' scientific notation. Therefore, when searching for the next command,
    // we should ignore 'e' and 'E'.
    if ((('A' <= c && c <= 'Z') || ('a' <= c && c <= 'z')) && c !== 'E' && c !== 'e') {
      return end;
    }
    end++;
  }
  return end;
}

class ExtractFloatResult {
  mEndPosition = 0;
  mEndWithNegOrDot = false;
}

function getFloats(s: string) {
  if (s.charAt(0) === 'z' || s.charAt(0) === 'Z') {
    return [];
  }
  const results: number[] = [];
  let startPosition = 1;
  let endPosition: number;
  const result = new ExtractFloatResult();
  const totalLength = s.length;
  while (startPosition < totalLength) {
    extract(s, startPosition, result);
    endPosition = result.mEndPosition;
    if (startPosition < endPosition) {
      results.push(parseFloat(s.substring(startPosition, endPosition)));
    }
    if (result.mEndWithNegOrDot) {
      startPosition = endPosition;
    } else {
      startPosition = endPosition + 1;
    }
  }
  return results;
}

/**
 * Calculate the position of the next comma or space or negative sign
 *
 * @param {string} s the string to search
 * @param {number} start the position to start searching
 * @param {ExtractFloatResult} result the result of the extraction, including the position of the the starting position
 * of next number, whether it is ending with a '-'.
 */
function extract(s: string, start: number, result: ExtractFloatResult) {
  let currentIndex = start;
  let foundSeparator = false;
  result.mEndWithNegOrDot = false;
  let secondDot = false;
  let isExponential = false;
  for (; currentIndex < s.length; currentIndex++) {
    const isPrevExponential = isExponential;
    isExponential = false;
    const currentChar = s.charAt(currentIndex);
    switch (currentChar) {
      case ' ':
      case ',':
        foundSeparator = true;
        break;
      case '-':
        if (currentIndex !== start && !isPrevExponential) {
          foundSeparator = true;
          result.mEndWithNegOrDot = true;
        }
        break;
      case '.':
        if (!secondDot) {
          secondDot = true;
        } else {
          foundSeparator = true;
          result.mEndWithNegOrDot = true;
        }
        break;
      case 'e':
      case 'E':
        isExponential = true;
        break;
    }
    if (foundSeparator) {
      break;
    }
  }
  result.mEndPosition = currentIndex;
}

function addCommand(
  path: CommandsBuilder,
  current: [number, number, number, number, number, number],
  prevCmd: string,
  cmd: string,
  val: number[],
) {
  let increment = 2;
  let [
    currentX,
    currentY,
    ctrlPointX,
    ctrlPointY,
    currentSegmentStartX,
    currentSegmentStartY,
  ] = current;
  let reflectiveCtrlPointX: number;
  let reflectiveCtrlPointY: number;
  switch (cmd) {
    case 'z':
    case 'Z':
      path.close();
      currentX = currentSegmentStartX;
      currentY = currentSegmentStartY;
      ctrlPointX = currentSegmentStartX;
      ctrlPointY = currentSegmentStartY;
      break;
    case 'm':
    case 'M':
    case 'l':
    case 'L':
    case 't':
    case 'T':
      increment = 2;
      break;
    case 'h':
    case 'H':
    case 'v':
    case 'V':
      increment = 1;
      break;
    case 'c':
    case 'C':
      increment = 6;
      break;
    case 's':
    case 'S':
    case 'q':
    case 'Q':
      increment = 4;
      break;
    case 'a':
    case 'A':
      increment = 7;
      break;
  }
  for (let k = 0; k < val.length; k += increment) {
    switch (cmd) {
      case 'm':
        currentX += val[k];
        currentY += val[k + 1];
        if (k > 0) {
          path.rLineTo(val[k], val[k + 1]);
        } else {
          path.rMoveTo(val[k], val[k + 1]);
          currentSegmentStartX = currentX;
          currentSegmentStartY = currentY;
        }
        break;
      case 'M':
        currentX = val[k];
        currentY = val[k + 1];
        if (k > 0) {
          path.lineTo(val[k], val[k + 1]);
        } else {
          path.moveTo(val[k], val[k + 1]);
          currentSegmentStartX = currentX;
          currentSegmentStartY = currentY;
        }
        break;
      case 'l':
        path.rLineTo(val[k], val[k + 1]);
        currentX += val[k];
        currentY += val[k + 1];
        break;
      case 'L':
        path.lineTo(val[k], val[k + 1]);
        currentX = val[k];
        currentY = val[k + 1];
        break;
      case 'h':
        path.rLineTo(val[k], 0);
        currentX += val[k];
        break;
      case 'H':
        path.lineTo(val[k], currentY);
        currentX = val[k];
        break;
      case 'v':
        path.rLineTo(0, val[k]);
        currentY += val[k];
        break;
      case 'V':
        path.lineTo(currentX, val[k]);
        currentY = val[k];
        break;
      case 'c':
        path.rCubicTo(val[k], val[k + 1], val[k + 2], val[k + 3], val[k + 4], val[k + 5]);
        ctrlPointX = currentX + val[k + 2];
        ctrlPointY = currentY + val[k + 3];
        currentX += val[k + 4];
        currentY += val[k + 5];
        break;
      case 'C':
        path.cubicTo(val[k], val[k + 1], val[k + 2], val[k + 3], val[k + 4], val[k + 5]);
        currentX = val[k + 4];
        currentY = val[k + 5];
        ctrlPointX = val[k + 2];
        ctrlPointY = val[k + 3];
        break;
      case 's':
        reflectiveCtrlPointX = 0;
        reflectiveCtrlPointY = 0;
        if (prevCmd === 'c' || prevCmd === 's' || prevCmd === 'C' || prevCmd === 'S') {
          reflectiveCtrlPointX = currentX - ctrlPointX;
          reflectiveCtrlPointY = currentY - ctrlPointY;
        }
        path.rCubicTo(
          reflectiveCtrlPointX,
          reflectiveCtrlPointY,
          val[k],
          val[k + 1],
          val[k + 2],
          val[k + 3],
        );
        ctrlPointX = currentX + val[k];
        ctrlPointY = currentY + val[k + 1];
        currentX += val[k + 2];
        currentY += val[k + 3];
        break;
      case 'S':
        reflectiveCtrlPointX = currentX;
        reflectiveCtrlPointY = currentY;
        if (prevCmd === 'c' || prevCmd === 's' || prevCmd === 'C' || prevCmd === 'S') {
          reflectiveCtrlPointX = 2 * currentX - ctrlPointX;
          reflectiveCtrlPointY = 2 * currentY - ctrlPointY;
        }
        path.cubicTo(
          reflectiveCtrlPointX,
          reflectiveCtrlPointY,
          val[k],
          val[k + 1],
          val[k + 2],
          val[k + 3],
        );
        ctrlPointX = val[k];
        ctrlPointY = val[k + 1];
        currentX = val[k + 2];
        currentY = val[k + 3];
        break;
      case 'q':
        path.rQuadTo(val[k], val[k + 1], val[k + 2], val[k + 3]);
        ctrlPointX = currentX + val[k];
        ctrlPointY = currentY + val[k + 1];
        currentX += val[k + 2];
        currentY += val[k + 3];
        break;
      case 'Q':
        path.quadTo(val[k], val[k + 1], val[k + 2], val[k + 3]);
        ctrlPointX = val[k];
        ctrlPointY = val[k + 1];
        currentX = val[k + 2];
        currentY = val[k + 3];
        break;
      case 't':
        reflectiveCtrlPointX = 0;
        reflectiveCtrlPointY = 0;
        if (prevCmd === 'q' || prevCmd === 't' || prevCmd === 'Q' || prevCmd === 'T') {
          reflectiveCtrlPointX = currentX - ctrlPointX;
          reflectiveCtrlPointY = currentY - ctrlPointY;
        }
        path.rQuadTo(reflectiveCtrlPointX, reflectiveCtrlPointY, val[k], val[k + 1]);
        ctrlPointX = currentX + reflectiveCtrlPointX;
        ctrlPointY = currentY + reflectiveCtrlPointY;
        currentX += val[k];
        currentY += val[k + 1];
        break;
      case 'T':
        reflectiveCtrlPointX = currentX;
        reflectiveCtrlPointY = currentY;
        if (prevCmd === 'q' || prevCmd === 't' || prevCmd === 'Q' || prevCmd === 'T') {
          reflectiveCtrlPointX = 2 * currentX - ctrlPointX;
          reflectiveCtrlPointY = 2 * currentY - ctrlPointY;
        }
        path.quadTo(reflectiveCtrlPointX, reflectiveCtrlPointY, val[k], val[k + 1]);
        ctrlPointX = reflectiveCtrlPointX;
        ctrlPointY = reflectiveCtrlPointY;
        currentX = val[k];
        currentY = val[k + 1];
        break;
      case 'a':
        drawArc(
          path,
          currentX,
          currentY,
          val[k + 5] + currentX,
          val[k + 6] + currentY,
          val[k],
          val[k + 1],
          val[k + 2],
          val[k + 3] !== 0,
          val[k + 4] !== 0,
        );
        currentX += val[k + 5];
        currentY += val[k + 6];
        ctrlPointX = currentX;
        ctrlPointY = currentY;
        break;
      case 'A':
        drawArc(
          path,
          currentX,
          currentY,
          val[k + 5],
          val[k + 6],
          val[k],
          val[k + 1],
          val[k + 2],
          val[k + 3] !== 0,
          val[k + 4] !== 0,
        );
        currentX = val[k + 5];
        currentY = val[k + 6];
        ctrlPointX = currentX;
        ctrlPointY = currentY;
        break;
    }
    prevCmd = cmd;
  }
  current[0] = currentX;
  current[1] = currentY;
  current[2] = ctrlPointX;
  current[3] = ctrlPointY;
  current[4] = currentSegmentStartX;
  current[5] = currentSegmentStartY;
}

function drawArc(
  p: CommandsBuilder,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  a: number,
  b: number,
  theta: number,
  isMoreThanHalf: boolean,
  isPositiveArc: boolean,
) {
  const thetaD = (theta * Math.PI) / 180;
  const cosTheta = Math.cos(thetaD);
  const sinTheta = Math.sin(thetaD);
  const x0p = (x0 * cosTheta + y0 * sinTheta) / a;
  const y0p = (-x0 * sinTheta + y0 * cosTheta) / b;
  const x1p = (x1 * cosTheta + y1 * sinTheta) / a;
  const y1p = (-x1 * sinTheta + y1 * cosTheta) / b;
  const dx = x0p - x1p;
  const dy = y0p - y1p;
  const xm = (x0p + x1p) / 2;
  const ym = (y0p + y1p) / 2;
  const dsq = dx * dx + dy * dy;
  if (dsq === 0.0) {
    return;
  }
  const disc = 1.0 / dsq - 1.0 / 4.0;
  if (disc < 0.0) {
    const adjust = Math.sqrt(dsq) / 1.99999;
    drawArc(p, x0, y0, x1, y1, a * adjust, b * adjust, theta, isMoreThanHalf, isPositiveArc);
    return;
  }
  const s = Math.sqrt(disc);
  const sdx = s * dx;
  const sdy = s * dy;
  let cx: number;
  let cy: number;
  if (isMoreThanHalf === isPositiveArc) {
    cx = xm - sdy;
    cy = ym + sdx;
  } else {
    cx = xm + sdy;
    cy = ym - sdx;
  }
  const eta0 = Math.atan2(y0p - cy, x0p - cx);
  const eta1 = Math.atan2(y1p - cy, x1p - cx);
  let sweep = eta1 - eta0;
  if (isPositiveArc !== sweep >= 0) {
    if (sweep > 0) {
      sweep -= 2 * Math.PI;
    } else {
      sweep += 2 * Math.PI;
    }
  }
  cx *= a;
  cy *= b;
  const tcx = cx;
  cx = cx * cosTheta - cy * sinTheta;
  cy = tcx * sinTheta + cy * cosTheta;
  arcToBezier(p, cx, cy, a, b, x0, y0, thetaD, eta0, sweep);
}

/**
 * Converts an arc to cubic Bezier segments and records them in p.
 *
 * @param {CommandsBuilder} p The target for the cubic Bezier segments
 * @param {number} cx The x coordinate center of the ellipse
 * @param {number} cy The y coordinate center of the ellipse
 * @param {number} a The radius of the ellipse in the horizontal direction
 * @param {number} b The radius of the ellipse in the vertical direction
 * @param {number} e1x E(eta1) x coordinate of the starting point of the arc
 * @param {number} e1y E(eta2) y coordinate of the starting point of the arc
 * @param {number} theta The angle that the ellipse bounding rectangle makes with horizontal plane
 * @param {number} start The start angle of the arc on the ellipse
 * @param {number} sweep The angle (positive or negative) of the sweep of the arc on the ellipse
 */
function arcToBezier(
  p: CommandsBuilder,
  cx: number,
  cy: number,
  a: number,
  b: number,
  e1x: number,
  e1y: number,
  theta: number,
  start: number,
  sweep: number,
) {
  const numSegments = Math.trunc(Math.ceil(Math.abs((sweep * 4) / Math.PI)));
  let eta1 = start;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const cosEta1 = Math.cos(eta1);
  const sinEta1 = Math.sin(eta1);
  let ep1x = -a * cosTheta * sinEta1 - b * sinTheta * cosEta1;
  let ep1y = -a * sinTheta * sinEta1 + b * cosTheta * cosEta1;
  const anglePerSegment = sweep / numSegments;
  for (let i = 0; i < numSegments; i++) {
    const eta2 = eta1 + anglePerSegment;
    const sinEta2 = Math.sin(eta2);
    const cosEta2 = Math.cos(eta2);
    const e2x = cx + a * cosTheta * cosEta2 - b * sinTheta * sinEta2;
    const e2y = cy + a * sinTheta * cosEta2 + b * cosTheta * sinEta2;
    const ep2x = -a * cosTheta * sinEta2 - b * sinTheta * cosEta2;
    const ep2y = -a * sinTheta * sinEta2 + b * cosTheta * cosEta2;
    const tanDiff2 = Math.tan((eta2 - eta1) / 2);
    const alpha = (Math.sin(eta2 - eta1) * (Math.sqrt(4 + 3 * tanDiff2 * tanDiff2) - 1)) / 3;
    const q1x = e1x + alpha * ep1x;
    const q1y = e1y + alpha * ep1y;
    const q2x = e2x - alpha * ep2x;
    const q2y = e2y - alpha * ep2y;
    p.cubicTo(q1x, q1y, q2x, q2y, e2x, e2y);
    eta1 = eta2;
    e1x = e2x;
    e1y = e2y;
    ep1x = ep2x;
    ep1y = ep2y;
  }
}

class CommandsBuilder {
  private commands: Command[] = [];
  private currentSegmentStartX = 0;
  private currentSegmentStartY = 0;
  private currentX = 0;
  private currentY = 0;

  rMoveTo(ri0: number, ri1: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    this.moveTo(i0, i1);
  }

  moveTo(i0: number, i1: number) {
    const start = this.commands.length ? { x: this.currentX, y: this.currentY } : undefined;
    const end = { x: i0, y: i1 };
    this.commands.push(newMove(start, end));
    this.currentSegmentStartX = i0;
    this.currentSegmentStartY = i1;
    this.currentX = i0;
    this.currentY = i1;
  }

  rLineTo(ri0: number, ri1: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    this.lineTo(i0, i1);
  }

  lineTo(i0: number, i1: number) {
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: i0, y: i1 };
    this.commands.push(newLine(start, end));
    this.currentX = i0;
    this.currentY = i1;
  }

  rQuadTo(ri0: number, ri1: number, ri2: number, ri3: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    const i2 = this.currentX + ri2;
    const i3 = this.currentY + ri3;
    this.quadTo(i0, i1, i2, i3);
  }

  quadTo(i0: number, i1: number, i2: number, i3: number) {
    const start = { x: this.currentX, y: this.currentY };
    const cp = { x: i0, y: i1 };
    const end = { x: i2, y: i3 };
    this.commands.push(newQuadraticCurve(start, cp, end));
    this.currentX = i2;
    this.currentY = i3;
  }

  rCubicTo(ri0: number, ri1: number, ri2: number, ri3: number, ri4: number, ri5: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    const i2 = this.currentX + ri2;
    const i3 = this.currentY + ri3;
    const i4 = this.currentX + ri4;
    const i5 = this.currentY + ri5;
    this.cubicTo(i0, i1, i2, i3, i4, i5);
  }

  cubicTo(i0: number, i1: number, i2: number, i3: number, i4: number, i5: number) {
    const start = { x: this.currentX, y: this.currentY };
    const cp1 = { x: i0, y: i1 };
    const cp2 = { x: i2, y: i3 };
    const end = { x: i4, y: i5 };
    this.commands.push(newBezierCurve(start, cp1, cp2, end));
    this.currentX = i4;
    this.currentY = i5;
  }

  close() {
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: this.currentSegmentStartX, y: this.currentSegmentStartY };
    this.commands.push(newClosePath(start, end));
    this.currentX = this.currentSegmentStartX;
    this.currentY = this.currentSegmentStartY;
  }

  toCommands() {
    return this.commands;
  }
}

/** Takes an list of Commands and converts them back into a SVG path string. */
export function commandsToString(commands: ReadonlyArray<Command>) {
  const tokens: string[] = [];
  commands.forEach(cmd => {
    tokens.push(cmd.type);
    const isClosePathCommand = cmd.type === 'Z';
    const pointsToNumberListFunc = (...points: { x: number; y: number }[]) =>
      points.reduce((list, p) => [...list, p.x, p.y], [] as number[]);
    const args = pointsToNumberListFunc(...(isClosePathCommand ? [] : cmd.points.slice(1)));
    tokens.splice(tokens.length, 0, ...args.map(n => Number(n.toFixed(3)).toString()));
  });
  return tokens.join(' ');
}

function newMove(start: Point, end: Point) {
  return new Command('M', [start, end]);
}

function newLine(start: Point, end: Point) {
  return new Command('L', [start, end]);
}

function newQuadraticCurve(start: Point, cp: Point, end: Point) {
  return new Command('Q', [start, cp, end]);
}

function newBezierCurve(start: Point, cp1: Point, cp2: Point, end: Point) {
  return new Command('C', [start, cp1, cp2, end]);
}

function newClosePath(start: Point, end: Point) {
  return new Command('Z', [start, end]);
}
