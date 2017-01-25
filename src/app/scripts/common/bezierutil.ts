import * as _ from 'lodash';
import * as BezierImpl from 'bezier-js';
import { Point } from './mathutil';

const MAX_PRECISION = 8;

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
export class Bezier {
  private readonly bezierImpl;
  private readonly points_: ReadonlyArray<Point>;
  private readonly length_: number;

  static findTimeByDistance(
    curve: Bezier, dist: number, epsilon = 0.001, maxDepth = -100): number {

    if (maxDepth > 0) {
      maxDepth = -maxDepth;
    }

    const lowToHighRatio = dist / (1 - dist);
    let step = -2;
    while (step > maxDepth) {
      const split = curve.bezierImpl.split(dist);
      const low = split.left.length();
      const high = split.right.length();
      const diff = low - lowToHighRatio * high;

      if (Math.abs(diff) < epsilon) {
        // We found a satisfactory midpoint t value.
        break;
      }

      // Jump half the t-distance in the direction of the bias.
      step = step - 1;
      dist += (diff > 0 ? -1 : 1) * Math.pow(2, step);
    }

    if (step === maxDepth) {
      console.log('could not find midpoint');
      throw new Error('could not find the midpoint!');
    }

    return dist;
  }

  constructor(...points: { x: number, y: number }[]) {
    if (points.length < 2 || 4 < points.length) {
      throw new Error('Invalid number of points');
    }
    points.forEach(p => {
      p.x = _.round(p.x, MAX_PRECISION);
      p.y = _.round(p.y, MAX_PRECISION);
    });
    if (points.length === 2) {
      points.push(points[1]);
    }
    this.bezierImpl = new BezierImpl(points);
    this.points_ = this.bezierImpl.points.map(p => new Point(p.x, p.y));
    this.length_ = this.bezierImpl.length();
  }

  get start() {
    return this.points[0];
  }

  get cp1() {
    return this.points[1];
  }

  get cp2() {
    return this.points[2];
  }

  get end() {
    return _.last(this.points);
  }

  get points() {
    return this.points_;
  }

  length() {
    return this.length_;
  }

  bbox(): BBox {
    return this.bezierImpl.bbox();
  }

  project(point: Point): Projection {
    const proj = this.bezierImpl.project(point);
    return {
      x: proj.x,
      y: proj.y,
      t: proj.t,
      d: proj.d,
    };
  }

  split(t1: number, t2?: number): Bezier {
    if (t2 === undefined) {
      return new Bezier(...this.bezierImpl.split(t1).points);
    }
    return new Bezier(...this.bezierImpl.split(t1, t2).points);
  }
}

export interface Projection {
  x: number;
  y: number;
  t: number;
  d: number;
}

export interface BBox {
  x: MinMax;
  y: MinMax;
}

export interface MinMax {
  min: number;
  mid?: number;
  max: number;
  size?: number;
}
