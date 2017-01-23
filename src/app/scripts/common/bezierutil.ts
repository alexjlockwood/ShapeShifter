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

  split(t1: number, t2: number): Bezier {
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
