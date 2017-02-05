import { PathHelper } from '.';
import {
  SvgChar, Projection, newLine, newQuadraticCurve,
  newBezierCurve, newClosePath, Command
} from '..';
import { MathUtil, Point } from '../../common';

export class PointHelper implements PathHelper {
  private readonly svgChar: SvgChar;
  private readonly point: Point;

  constructor(svgChar: SvgChar, point: Point) {
    this.svgChar = svgChar;
    this.point = point;
  }

  pathLength() {
    return 0;
  }

  project(point: Point): Projection {
    const x = this.point.x;
    const y = this.point.y;
    const t = 0.5;
    const d = MathUtil.distance(this.point, point);
    return { x, y, t, d };
  }

  split(t1: number, t2: number): PathHelper {
    return new PointHelper(this.svgChar, this.point);
  }

  convert(svgChar: SvgChar) {
    return new PointHelper(svgChar, this.point);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand(isSplit: boolean) {
    switch (this.svgChar) {
      case 'L':
        return newLine(this.point, this.point, isSplit);
      case 'Q':
        return newQuadraticCurve(this.point, this.point, this.point, isSplit);
      case 'C':
        return newBezierCurve(
          this.point, this.point, this.point, this.point, isSplit);
      case 'Z':
        return newClosePath(this.point, this.point, isSplit);
    }
    throw new Error('Invalid command type: ' + this.svgChar);
  }
}
