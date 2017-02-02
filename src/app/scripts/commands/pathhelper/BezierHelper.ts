import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { MathUtil, Point } from '../../common';
import {
  SvgChar, Projection, newLine, newQuadraticCurve,
  newBezierCurve, newClosePath, Command
} from '..';
import { PathHelper } from '.';
import { PointHelper } from './PointHelper';
import { LineHelper } from './LineHelper';

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
export class BezierHelper implements PathHelper {
  private readonly svgChar: SvgChar;
  private readonly bezierJs;
  private readonly points: ReadonlyArray<Point>;
  private readonly length: number;

  constructor(svgChar: SvgChar, ...points: Point[]) {
    this.svgChar = svgChar;
    this.bezierJs = new BezierJs(points);
    this.points = points;
    this.length = this.bezierJs.length();
  }

  pathLength() {
    return this.length;
  }

  project(point: Point): Projection {
    const proj = this.bezierJs.project(point);
    return { x: proj.x, y: proj.y, t: proj.t, d: proj.d };
  }

  split(t1: number, t2: number): PathHelper {
    if (t1 === t2) {
      const p = this.bezierJs.get(t1);
      return new PointHelper(this.svgChar, new Point(p.x, p.y));
    }
    const splitBezPoints = this.bezierJs.split(t1, t2).points;
    const points: Point[] = splitBezPoints.map(p => new Point(p.x, p.y));
    const uniquePoints = _.uniqWith(points, (p1, p2) => p1.equals(p2));
    if (uniquePoints.length === 2) {
      return new LineHelper(this.svgChar, _.first(points), _.last(points));
    }
    return new BezierHelper(this.svgChar, ...points);
  }

  convert(svgChar: SvgChar) {
    return new BezierHelper(svgChar, ...this.points);
  }

  findTimeByDistance(distance: number): number {
    const epsilon = 0.001;
    const maxDepth = -100;

    const lowToHighRatio = distance / (1 - distance);
    let step = -2;
    while (step > maxDepth) {
      const split = this.bezierJs.split(distance);
      const low = split.left.length();
      const high = split.right.length();
      const diff = low - lowToHighRatio * high;

      if (Math.abs(diff) < epsilon) {
        // We found a satisfactory midpoint t value.
        break;
      }

      // Jump half the t-distance in the direction of the bias.
      step = step - 1;
      distance += (diff > 0 ? -1 : 1) * Math.pow(2, step);
    }

    if (step === maxDepth) {
      // TODO: handle degenerate curves!!!!!
      console.warn('could not find the midpoint!');
    }

    return distance;
  }

  toCommand(isSplit: boolean): Command {
    switch (this.svgChar) {
      case 'Q':
        return newQuadraticCurve(
          this.points[0], this.points[1], this.points[2], isSplit);
      case 'C':
        return newBezierCurve(
          this.points[0], this.points[1], this.points[2], this.points[3], isSplit);
    }
    throw new Error('Invalid command type: ' + this.svgChar);
  }
}
