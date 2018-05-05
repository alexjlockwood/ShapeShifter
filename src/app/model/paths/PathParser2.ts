import { Command } from './Command';

class PathParser {
  static parse(pathData: string): PathDatum[] {
    if (!pathData) {
      pathData = '';
    }
    pathData = pathData.trim();
    let start = 0;
    let end = 1;
    const list: PathDatum[] = [];
    while (end < pathData.length) {
      end = nextStart(pathData, end);
      const s = pathData.substring(start, end).trim();
      if (s.length > 0) {
        const val: number[] = getFloats(s);
        addNode(list, s.charAt(0), val);
      }
      start = end;
      end++;
    }
    if (end - start === 1 && start < pathData.length) {
      addNode(list, pathData.charAt(start), []);
    }
    return list.slice(0);
  }

  static toPath(nodes: PathDatum[], path: Path) {
    const current = [0, 0, 0, 0, 0, 0];
    let previousCommand = 'm';
    for (let i = 0; i < nodes.length; i++) {
      PathParser.addCommand(path, current, previousCommand, nodes[i].type, nodes[i].params);
      previousCommand = nodes[i].type;
    }
  }

  /**
   * Calculate the position of the next comma or space or negative sign
   *
   * @param {string} s the string to search
   * @param {number} start the position to start searching
   * @param {ExtractFloatResult} result the result of the extraction, including the position of the the starting position
   * of next number, whether it is ending with a '-'.
   * @private
   */
  static extract(s: string, start: number, result: ExtractFloatResult) {
    let currentIndex: number = start;
    let foundSeparator: boolean = false;
    result.mEndWithNegOrDot = false;
    let secondDot: boolean = false;
    let isExponential: boolean = false;
    for (; currentIndex < s.length; currentIndex++) {
      let isPrevExponential: boolean = isExponential;
      isExponential = false;
      let currentChar: string = s.charAt(currentIndex);
      switch (currentChar.charCodeAt(0)) {
        case 32 /* ' ' */:
        case 44 /* ',' */:
          foundSeparator = true;
          break;
        case 45 /* '-' */:
          if (currentIndex !== start && !isPrevExponential) {
            foundSeparator = true;
            result.mEndWithNegOrDot = true;
          }
          break;
        case 46 /* '.' */:
          if (!secondDot) {
            secondDot = true;
          } else {
            foundSeparator = true;
            result.mEndWithNegOrDot = true;
          }
          break;
        case 101 /* 'e' */:
        case 69 /* 'E' */:
          isExponential = true;
          break;
      }
      if (foundSeparator) {
        break;
      }
    }
    result.mEndPosition = currentIndex;
  }

  static addCommand(path: Path, current: number[], prevCmd: string, cmd: string, val: number[]) {
    let increment: number = 2;
    let currentX: number = current[0];
    let currentY: number = current[1];
    let ctrlPointX: number = current[2];
    let ctrlPointY: number = current[3];
    let currentSegmentStartX: number = current[4];
    let currentSegmentStartY: number = current[5];
    let reflectiveCtrlPointX: number;
    let reflectiveCtrlPointY: number;
    switch (cmd.charCodeAt(0)) {
      case 122 /* 'z' */:
      case 90 /* 'Z' */:
        path.close();
        currentX = currentSegmentStartX;
        currentY = currentSegmentStartY;
        ctrlPointX = currentSegmentStartX;
        ctrlPointY = currentSegmentStartY;
        // path.moveTo(currentX, currentY);
        break;
      case 109 /* 'm' */:
      case 77 /* 'M' */:
      case 108 /* 'l' */:
      case 76 /* 'L' */:
      case 116 /* 't' */:
      case 84 /* 'T' */:
        increment = 2;
        break;
      case 104 /* 'h' */:
      case 72 /* 'H' */:
      case 118 /* 'v' */:
      case 86 /* 'V' */:
        increment = 1;
        break;
      case 99 /* 'c' */:
      case 67 /* 'C' */:
        increment = 6;
        break;
      case 115 /* 's' */:
      case 83 /* 'S' */:
      case 113 /* 'q' */:
      case 81 /* 'Q' */:
        increment = 4;
        break;
      case 97 /* 'a' */:
      case 65 /* 'A' */:
        increment = 7;
        break;
    }
    for (let k: number = 0; k < val.length; k += increment) {
      switch (cmd.charCodeAt(0)) {
        case 109 /* 'm' */:
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
        case 77 /* 'M' */:
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
        case 108 /* 'l' */:
          path.rLineTo(val[k], val[k + 1]);
          currentX += val[k];
          currentY += val[k + 1];
          break;
        case 76 /* 'L' */:
          path.lineTo(val[k], val[k + 1]);
          currentX = val[k];
          currentY = val[k + 1];
          break;
        case 104 /* 'h' */:
          path.rLineTo(val[k], 0);
          currentX += val[k];
          break;
        case 72 /* 'H' */:
          path.lineTo(val[k], currentY);
          currentX = val[k];
          break;
        case 118 /* 'v' */:
          path.rLineTo(0, val[k]);
          currentY += val[k];
          break;
        case 86 /* 'V' */:
          path.lineTo(currentX, val[k]);
          currentY = val[k];
          break;
        case 99 /* 'c' */:
          path.rCubicTo(val[k], val[k + 1], val[k + 2], val[k + 3], val[k + 4], val[k + 5]);
          ctrlPointX = currentX + val[k + 2];
          ctrlPointY = currentY + val[k + 3];
          currentX += val[k + 4];
          currentY += val[k + 5];
          break;
        case 67 /* 'C' */:
          path.cubicTo(val[k], val[k + 1], val[k + 2], val[k + 3], val[k + 4], val[k + 5]);
          currentX = val[k + 4];
          currentY = val[k + 5];
          ctrlPointX = val[k + 2];
          ctrlPointY = val[k + 3];
          break;
        case 115 /* 's' */:
          reflectiveCtrlPointX = 0;
          reflectiveCtrlPointY = 0;
          if (
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'c'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              's'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'C'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) == 'S'.charCodeAt(0)
          ) {
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
        case 83 /* 'S' */:
          reflectiveCtrlPointX = currentX;
          reflectiveCtrlPointY = currentY;
          if (
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'c'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              's'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'C'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) == 'S'.charCodeAt(0)
          ) {
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
        case 113 /* 'q' */:
          path.rQuadTo(val[k], val[k + 1], val[k + 2], val[k + 3]);
          ctrlPointX = currentX + val[k];
          ctrlPointY = currentY + val[k + 1];
          currentX += val[k + 2];
          currentY += val[k + 3];
          break;
        case 81 /* 'Q' */:
          path.quadTo(val[k], val[k + 1], val[k + 2], val[k + 3]);
          ctrlPointX = val[k];
          ctrlPointY = val[k + 1];
          currentX = val[k + 2];
          currentY = val[k + 3];
          break;
        case 116 /* 't' */:
          reflectiveCtrlPointX = 0;
          reflectiveCtrlPointY = 0;
          if (
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'q'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              't'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'Q'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) == 'T'.charCodeAt(0)
          ) {
            reflectiveCtrlPointX = currentX - ctrlPointX;
            reflectiveCtrlPointY = currentY - ctrlPointY;
          }
          path.rQuadTo(reflectiveCtrlPointX, reflectiveCtrlPointY, val[k], val[k + 1]);
          ctrlPointX = currentX + reflectiveCtrlPointX;
          ctrlPointY = currentY + reflectiveCtrlPointY;
          currentX += val[k];
          currentY += val[k + 1];
          break;
        case 84 /* 'T' */:
          reflectiveCtrlPointX = currentX;
          reflectiveCtrlPointY = currentY;
          if (
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'q'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              't'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) ==
              'Q'.charCodeAt(0) ||
            (c => (c.charCodeAt == null ? <any>c : c.charCodeAt(0)))(prevCmd) == 'T'.charCodeAt(0)
          ) {
            reflectiveCtrlPointX = 2 * currentX - ctrlPointX;
            reflectiveCtrlPointY = 2 * currentY - ctrlPointY;
          }
          path.quadTo(reflectiveCtrlPointX, reflectiveCtrlPointY, val[k], val[k + 1]);
          ctrlPointX = reflectiveCtrlPointX;
          ctrlPointY = reflectiveCtrlPointY;
          currentX = val[k];
          currentY = val[k + 1];
          break;
        case 97 /* 'a' */:
          PathParser.drawArc(
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
        case 65 /* 'A' */:
          PathParser.drawArc(
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

  static drawArc(
    p: Path,
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
    const thetaD: number = /* toRadians */ (x => x * Math.PI / 180)(theta);
    const cosTheta: number = Math.cos(thetaD);
    const sinTheta: number = Math.sin(thetaD);
    let x0p: number = (x0 * cosTheta + y0 * sinTheta) / a;
    let y0p: number = (-x0 * sinTheta + y0 * cosTheta) / b;
    let x1p: number = (x1 * cosTheta + y1 * sinTheta) / a;
    let y1p: number = (-x1 * sinTheta + y1 * cosTheta) / b;
    let dx: number = x0p - x1p;
    let dy: number = y0p - y1p;
    let xm: number = (x0p + x1p) / 2;
    let ym: number = (y0p + y1p) / 2;
    let dsq: number = dx * dx + dy * dy;
    if (dsq === 0.0) {
      return;
    }
    let disc: number = 1.0 / dsq - 1.0 / 4.0;
    if (disc < 0.0) {
      let adjust: number = <number>(Math.sqrt(dsq) / 1.99999);
      PathParser.drawArc(
        p,
        x0,
        y0,
        x1,
        y1,
        a * adjust,
        b * adjust,
        theta,
        isMoreThanHalf,
        isPositiveArc,
      );
      return;
    }
    let s: number = Math.sqrt(disc);
    let sdx: number = s * dx;
    let sdy: number = s * dy;
    let cx: number;
    let cy: number;
    if (isMoreThanHalf === isPositiveArc) {
      cx = xm - sdy;
      cy = ym + sdx;
    } else {
      cx = xm + sdy;
      cy = ym - sdx;
    }
    let eta0: number = Math.atan2(y0p - cy, x0p - cx);
    let eta1: number = Math.atan2(y1p - cy, x1p - cx);
    let sweep: number = eta1 - eta0;
    if (isPositiveArc !== sweep >= 0) {
      if (sweep > 0) {
        sweep -= 2 * Math.PI;
      } else {
        sweep += 2 * Math.PI;
      }
    }
    cx *= a;
    cy *= b;
    let tcx: number = cx;
    cx = cx * cosTheta - cy * sinTheta;
    cy = tcx * sinTheta + cy * cosTheta;
    PathParser.arcToBezier(p, cx, cy, a, b, x0, y0, thetaD, eta0, sweep);
  }

  /**
   * Converts an arc to cubic Bezier segments and records them in p.
   *
   * @param {Path} p The target for the cubic Bezier segments
   * @param {number} cx The x coordinate center of the ellipse
   * @param {number} cy The y coordinate center of the ellipse
   * @param {number} a The radius of the ellipse in the horizontal direction
   * @param {number} b The radius of the ellipse in the vertical direction
   * @param {number} e1x E(eta1) x coordinate of the starting point of the arc
   * @param {number} e1y E(eta2) y coordinate of the starting point of the arc
   * @param {number} theta The angle that the ellipse bounding rectangle makes with horizontal plane
   * @param {number} start The start angle of the arc on the ellipse
   * @param {number} sweep The angle (positive or negative) of the sweep of the arc on the ellipse
   * @private
   */
  static arcToBezier(
    p: Path,
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
    let numSegments: number = (<number>Math.ceil(Math.abs(sweep * 4 / Math.PI))) | 0;
    let eta1: number = start;
    let cosTheta: number = Math.cos(theta);
    let sinTheta: number = Math.sin(theta);
    let cosEta1: number = Math.cos(eta1);
    let sinEta1: number = Math.sin(eta1);
    let ep1x: number = -a * cosTheta * sinEta1 - b * sinTheta * cosEta1;
    let ep1y: number = -a * sinTheta * sinEta1 + b * cosTheta * cosEta1;
    let anglePerSegment: number = sweep / numSegments;
    for (let i: number = 0; i < numSegments; i++) {
      let eta2: number = eta1 + anglePerSegment;
      let sinEta2: number = Math.sin(eta2);
      let cosEta2: number = Math.cos(eta2);
      let e2x: number = cx + a * cosTheta * cosEta2 - b * sinTheta * sinEta2;
      let e2y: number = cy + a * sinTheta * cosEta2 + b * cosTheta * sinEta2;
      let ep2x: number = -a * cosTheta * sinEta2 - b * sinTheta * cosEta2;
      let ep2y: number = -a * sinTheta * sinEta2 + b * cosTheta * cosEta2;
      let tanDiff2: number = Math.tan((eta2 - eta1) / 2);
      let alpha: number = Math.sin(eta2 - eta1) * (Math.sqrt(4 + 3 * tanDiff2 * tanDiff2) - 1) / 3;
      let q1x: number = e1x + alpha * ep1x;
      let q1y: number = e1y + alpha * ep1y;
      let q2x: number = e2x - alpha * ep2x;
      let q2y: number = e2y - alpha * ep2y;
      // p.rLineTo(0, 0);
      p.cubicTo(<number>q1x, <number>q1y, <number>q2x, <number>q2y, <number>e2x, <number>e2y);
      eta1 = eta2;
      e1x = e2x;
      e1y = e2y;
      ep1x = ep2x;
      ep1y = ep2y;
    }
  }

  static copyOfRange(original: number[], start: number, end: number): number[] {
    if (start > end) {
      throw Object.defineProperty(new Error(), '__classes', {
        configurable: true,
        value: [
          'java.lang.Throwable',
          'java.lang.Object',
          'java.lang.RuntimeException',
          'java.lang.IllegalArgumentException',
          'java.lang.Exception',
        ],
      });
    }
    let originalLength: number = original.length;
    if (start < 0 || start > originalLength) {
      throw Object.defineProperty(new Error(), '__classes', {
        configurable: true,
        value: [
          'java.lang.Throwable',
          'java.lang.IndexOutOfBoundsException',
          'java.lang.Object',
          'java.lang.ArrayIndexOutOfBoundsException',
          'java.lang.RuntimeException',
          'java.lang.Exception',
        ],
      });
    }
    let resultLength: number = end - start;
    let copyLength: number = Math.min(resultLength, originalLength - start);
    let result: number[] = (s => {
      let a = [];
      while (s-- > 0) a.push(0);
      return a;
    })(resultLength);
    /* arraycopy */ ((srcPts, srcOff, dstPts, dstOff, size) => {
      if (srcPts !== dstPts || dstOff >= srcOff + size) {
        while (--size >= 0) dstPts[dstOff++] = srcPts[srcOff++];
      } else {
        let tmp = srcPts.slice(srcOff, srcOff + size);
        for (let i = 0; i < size; i++) dstPts[dstOff++] = tmp[i];
      }
    })(original, start, result, 0, copyLength);
    return result;
  }
}

class Path {
  private nodes: Command[] = [];
  private currentSegmentStartX = 0;
  private currentSegmentStartY = 0;
  private currentX = 0;
  private currentY = 0;

  moveTo(i0: number, i1: number) {
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: i0, y: i1 };
    this.nodes.push(new Command('M', [start, end]));
    this.currentSegmentStartX = i0;
    this.currentSegmentStartY = i1;
    this.currentX = i0;
    this.currentY = i1;
  }

  rMoveTo(ri0: number, ri1: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    this.moveTo(i0, i1);
  }

  lineTo(i0: number, i1: number) {
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: i0, y: i1 };
    this.nodes.push(new Command('L', [start, end]));
    this.currentX = i0;
    this.currentY = i1;
  }

  rLineTo(ri0: number, ri1: number) {
    const i0 = this.currentX + ri0;
    const i1 = this.currentY + ri1;
    this.lineTo(i0, i1);
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
    this.nodes.push(new Command('Q', [start, cp, end]));
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
    this.nodes.push(new Command('C', [start, cp1, cp2, end]));
    this.currentX = i4;
    this.currentY = i5;
  }

  close() {
    const start = { x: this.currentX, y: this.currentY };
    const end = { x: this.currentSegmentStartX, y: this.currentSegmentStartY };
    this.nodes.push(new Command('Z', [start, end]));
    this.currentX = this.currentSegmentStartX;
    this.currentY = this.currentSegmentStartY;
  }

  toCommands() {
    return this.nodes;
  }
}

class PathDatum {
  type: string;

  params: number[];

  constructor(type: string, params: number[]) {
    this.type = null;
    this.params = null;
    this.type = type;
    this.params = params;
  }
}

/**
 * Takes an list of DrawCommands and converts them back into a SVG path string.
 */
function commandsToString(commands: ReadonlyArray<Command>) {
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

function nextStart(s: string, end: number) {
  while (end < s.length) {
    const code = s.charCodeAt(end);
    // Note that 'e' or 'E' are not valid path commands, but could be used for floating
    // point numbers' scientific notation. Therefore, when searching for the next command,
    // we should ignore 'e' and 'E'.
    const A = 'A'.charCodeAt(0);
    const Z = 'Z'.charCodeAt(0);
    const a = 'a'.charCodeAt(0);
    const z = 'z'.charCodeAt(0);
    const E = 'E'.charCodeAt(0);
    const e = 'e'.charCodeAt(0);
    if (
      ((code - A) * (code - Z) <= 0 || (code - a) * (code - z) <= 0) &&
      code !== E &&
      code !== e
    ) {
      return end;
    }
    end++;
  }
  return end;
}

function addNode(list: PathDatum[], cmd: string, val: number[]) {
  list.push(new PathDatum(cmd, val));
}

class ExtractFloatResult {
  mEndPosition = 0;
  mEndWithNegOrDot = false;
}

function getFloats(s: string): number[] {
  if (s.charAt(0) === 'z' || s.charAt(0) === 'Z') {
    return [];
  }
  const results: number[] = new Array(s.length);
  let count = 0;
  let startPosition = 1;
  let endPosition: number;
  const result = new ExtractFloatResult();
  const totalLength = s.length;
  while (startPosition < totalLength) {
    PathParser.extract(s, startPosition, result);
    endPosition = result.mEndPosition;
    if (startPosition < endPosition) {
      results[count++] = parseFloat(s.substring(startPosition, endPosition));
    }
    if (result.mEndWithNegOrDot) {
      startPosition = endPosition;
    } else {
      startPosition = endPosition + 1;
    }
  }
  return PathParser.copyOfRange(results, 0, count);
}

const nodes = PathParser.parse(
  'M 54 9.422 c -6.555 6.043 -13.558 13.787 -17.812 22.27 C 31.93 23.209 24.926 15.465 18.372 9.422 a 101.486 101.486 0 0 0 17.811 1.564 A 101.5 101.5 0 0 0 54 9.422',
);
console.log(nodes);
const path = new Path();
PathParser.toPath(nodes, path);
console.log(commandsToString(path.toCommands()));
