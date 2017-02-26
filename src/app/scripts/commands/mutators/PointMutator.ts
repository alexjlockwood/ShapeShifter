import { Mutator } from '.';
import {
  SvgChar, Projection, newLine, newQuadraticCurve,
  newBezierCurve, newClosePath
} from '..';
import { MathUtil, Point } from '../../common';

export class PointMutator implements Mutator {
  private readonly svgChar: SvgChar;
  private readonly point: Point;

  constructor(svgChar: SvgChar, point: Point) {
    this.svgChar = svgChar;
    this.point = point;
  }

  getPathLength() {
    return 0;
  }

  project(point: Point): Projection {
    const x = this.point.x;
    const y = this.point.y;
    const t = 0.5;
    const d = MathUtil.distance(this.point, point);
    return { x, y, t, d };
  }

  split(t1: number, t2: number): Mutator {
    return new PointMutator(this.svgChar, this.point);
  }

  convert(svgChar: SvgChar) {
    return new PointMutator(svgChar, this.point);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand() {
    switch (this.svgChar) {
      case 'L':
        return newLine(this.point, this.point);
      case 'Q':
        return newQuadraticCurve(this.point, this.point, this.point);
      case 'C':
        return newBezierCurve(
          this.point, this.point, this.point, this.point);
      case 'Z':
        return newClosePath(this.point, this.point);
    }
    throw new Error('Invalid command type: ' + this.svgChar);
  }
}
