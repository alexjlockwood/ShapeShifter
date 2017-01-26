import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { Point } from './mathutil';

const MAX_PRECISION = 8;

export interface Bezier {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
  length(): number;
  bbox(): BBox;
  project(point: Point): Projection;
  split(t1: number, t2?: number): Bezier;
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

interface IPoint { x: number; y: number; };

export function createBezier(...points: IPoint[]) {
  return new BezierImpl(...points);
}

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 * TODO: make this more general (optimize for lines, etc.)
 */
class BezierImpl implements Bezier {
  private readonly bezierJs;
  private readonly points_: ReadonlyArray<Point>;
  private readonly length_: number;

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
    this.bezierJs = new BezierJs(points);
    this.points_ = this.bezierJs.points.map(p => new Point(p.x, p.y));
    this.length_ = this.bezierJs.length();
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
    return this.bezierJs.bbox();
  }

  project(point: Point): Projection {
    const proj = this.bezierJs.project(point);
    return {
      x: proj.x,
      y: proj.y,
      t: proj.t,
      d: proj.d,
    };
  }

  split(t1: number, t2?: number): Bezier {
    if (t2 === undefined) {
      return new BezierImpl(...this.bezierJs.split(t1).points);
    }
    return new BezierImpl(...this.bezierJs.split(t1, t2).points);
  }
}

// export function findTimeByDistance(
//   curve: Bezier, dist: number, epsilon = 0.001, maxDepth = -100): number {
//   // TODO: check for degenerate curve cases

//   if (maxDepth > 0) {
//     maxDepth = -maxDepth;
//   }

//   const lowToHighRatio = dist / (1 - dist);
//   let step = -2;
//   while (step > maxDepth) {
//     const split = curve.bezierImpl.split(dist);
//     const low = split.left.length();
//     const high = split.right.length();
//     const diff = low - lowToHighRatio * high;

//     if (Math.abs(diff) < epsilon) {
//       // We found a satisfactory midpoint t value.
//       break;
//     }

//     // Jump half the t-distance in the direction of the bias.
//     step = step - 1;
//     dist += (diff > 0 ? -1 : 1) * Math.pow(2, step);
//   }

//   if (step === maxDepth) {
//     console.log('could not find midpoint');
//     throw new Error('could not find the midpoint!');
//   }

//   return dist;
// }
