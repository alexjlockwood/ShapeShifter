import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { MathUtil, Point } from '../../../common';
import { Projection } from '..';
import { PathHelper } from '.';
import { PointHelper } from './PointHelper';
import { LineHelper } from './LineHelper';

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
export class BezierHelper implements PathHelper {
  private readonly bezierJs;
  private readonly points_: ReadonlyArray<Point>;
  private readonly length_: number;

  constructor(...points: Point[]) {
    this.bezierJs = new BezierJs(points);
    this.points_ = points;
    this.length_ = this.bezierJs.length();
  }

  get points() {
    return this.points_;
  }

  pathLength() {
    return this.length_;
  }

  project(point: Point): Projection {
    const proj = this.bezierJs.project(point);
    return { x: proj.x, y: proj.y, t: proj.t, d: proj.d };
  }

  split(t1: number, t2: number): PathHelper {
    // TODO: return a point helper if t1 === t2?
    // TODO: handle degenerate curves (it is possible for points to be undefined)
    return new BezierHelper(...this.bezierJs.split(t1, t2).points
      .map(p => new Point(p.x, p.y)));
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
}
