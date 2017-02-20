import { Mutator } from '.';
import { SvgChar, Projection, newLine, newQuadraticCurve, newBezierCurve, newClosePath } from '..';
import { MathUtil, Point } from '../../common';
import { PointMutator } from './PointMutator';

export class LineMutator implements Mutator {
  private readonly svgChar: SvgChar;
  private readonly p1: Point;
  private readonly p2: Point;

  constructor(svgChar: SvgChar, p1: Point, p2: Point) {
    this.svgChar = svgChar;
    this.p1 = p1;
    this.p2 = p2;
  }

  pathLength() {
    return MathUtil.distance(this.p1, this.p2);
  }

  project({x, y}: Point): Projection {
    const {x: x1, y: y1} = this.p1;
    const {x: x2, y: y2} = this.p2;
    const a = x2 - x1;
    const b = y2 - y1;
    const dot = (x - x1) * a + (y - y1) * b;
    const lenSq = a * a + b * b;
    const param = lenSq === 0 ? -1 : dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * a;
      yy = y1 + param * b;
    }
    const dx = x - xx;
    const dy = y - yy;
    const dd = Math.sqrt(dx * dx + dy * dy);
    let dt;
    if (x2 !== x1) {
      dt = (xx - x1) / (x2 - x1);
    } else if (y2 !== y1) {
      dt = (yy - y1) / (y2 - y1);
    } else {
      dt = 0.5;
    }
    return { x: xx, y: yy, d: dd, t: dt };
  }

  split(t1: number, t2: number): Mutator {
    const {x: x1, y: y1} = this.p1;
    const {x: x2, y: y2} = this.p2;
    const p1 = new Point(
      MathUtil.lerp(x1, x2, t1),
      MathUtil.lerp(y1, y2, t1));
    const p2 = new Point(
      MathUtil.lerp(x1, x2, t2),
      MathUtil.lerp(y1, y2, t2));
    if (p1.equals(p2)) {
      return new PointMutator(this.svgChar, p1);
    }
    return new LineMutator(this.svgChar, p1, p2);
  }

  convert(svgChar: SvgChar) {
    return new LineMutator(svgChar, this.p1, this.p2);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand(isSplit: boolean) {
    switch (this.svgChar) {
      case 'L':
        return newLine(this.p1, this.p2, isSplit);
      case 'Q':
        const cp = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 0.5),
          MathUtil.lerp(this.p1.y, this.p2.y, 0.5));
        return newQuadraticCurve(this.p1, cp, this.p2, isSplit);
      case 'C':
        const cp1 = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 1 / 3),
          MathUtil.lerp(this.p1.y, this.p2.y, 1 / 3));
        const cp2 = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 2 / 3),
          MathUtil.lerp(this.p1.y, this.p2.y, 2 / 3));
        return newBezierCurve(
          this.p1, cp1, cp2, this.p2, isSplit);
      case 'Z':
        return newClosePath(this.p1, this.p2, isSplit);
    }
    throw new Error('Invalid command type: ' + this.svgChar);
  }
}
