import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { Point } from '../../common';
import { SvgChar, ProjectionResult, newQuadraticCurve, newBezierCurve } from '..';
import { Calculator, BBox, Line } from '.';
import { PointCalculator } from './PointCalculator';
import { LineCalculator } from './LineCalculator';

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
export class BezierCalculator implements Calculator {
  private readonly svgChar: SvgChar;
  private readonly points: ReadonlyArray<Point>;
  private length: number;
  private bbox: BBox;
  private bezierJs_;

  constructor(svgChar: SvgChar, ...points: Point[]) {
    this.svgChar = svgChar;
    this.points = points;
  }

  get bezierJs() {
    if (this.bezierJs_ === undefined) {
      this.bezierJs_ = new BezierJs(this.points);
    }
    return this.bezierJs_;
  }

  getPathLength() {
    if (this.length === undefined) {
      this.length = this.bezierJs.length();
    }
    return this.length;
  }

  project(point: Point): ProjectionResult {
    const proj = this.bezierJs.project(point);
    return { x: proj.x, y: proj.y, t: proj.t, d: proj.d };
  }

  split(t1: number, t2: number): Calculator {
    if (t1 === t2) {
      const p = this.bezierJs.get(t1);
      return new PointCalculator(this.svgChar, new Point(p.x, p.y));
    }
    const splitBezPoints = this.bezierJs.split(t1, t2).points;
    const points: Point[] = splitBezPoints.map(p => new Point(p.x, p.y));
    const uniquePoints = _.uniqWith(points, (p1, p2) => p1.equals(p2));
    if (uniquePoints.length === 2) {
      return new LineCalculator(this.svgChar, _.first(points), _.last(points));
    }
    return new BezierCalculator(this.svgChar, ...points);
  }

  convert(svgChar: SvgChar) {
    if (this.svgChar === 'Q' && svgChar === 'C') {
      // TODO: double check this math
      const qcp0 = this.points[0];
      const qcp1 = this.points[1];
      const qcp2 = this.points[2];
      const ccp0 = qcp0;
      const ccp1 = new Point(
        qcp0.x + (2 / 3) * (qcp1.x - qcp0.x),
        qcp0.y + (2 / 3) * (qcp1.y - qcp0.y));
      const ccp2 = new Point(
        qcp2.x + (2 / 3) * (qcp1.x - qcp2.x),
        qcp2.y + (2 / 3) * (qcp1.y - qcp2.y));
      const ccp3 = qcp2;
      return new BezierCalculator(svgChar, ccp0, ccp1, ccp2, ccp3);
    }
    return new BezierCalculator(svgChar, ...this.points);
  }

  findTimeByDistance(distance: number): number {
    if (distance === 0 || distance === 1) {
      return distance;
    }
    const originalDistance = distance;
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
      console.warn(
        'Could not find the midpoint for: ',
        `${this.svgChar} ` + this.points.toString());
      return originalDistance;
    }

    return distance;
  }

  toCommand() {
    switch (this.svgChar) {
      case 'Q':
        return newQuadraticCurve(
          this.points[0], this.points[1], this.points[2]);
      case 'C':
        return newBezierCurve(
          this.points[0], this.points[1], this.points[2], this.points[3]);
    }
    throw new Error('Invalid command type: ' + this.svgChar);
  }

  getBoundingBox() {
    if (this.bbox === undefined) {
      const bbox = this.bezierJs.bbox();
      this.bbox = {
        x: { min: bbox.x.min, max: bbox.x.max },
        y: { min: bbox.y.min, max: bbox.y.max },
      };
    }
    return this.bbox;
  }

  intersects(line: Line) {
    return this.bezierJs.intersects(line);
  }
}
