import * as BezierImpl from 'bezier-js';
import { Point } from './mathutil';

export class Bezier {
  private readonly bezierImpl;
  private readonly points_: Point[];

  constructor(...points: { x: number, y: number }[]) {
    if (points.length < 2 || 4 < points.length) {
      throw new Error('Invalid number of points');
    }
    if (points.length === 2) {
      points.push(points[1]);
    }
    this.bezierImpl = new BezierImpl(points);
    this.points_ = this.bezierImpl.points.map(p => new Point(p.x, p.y));
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
    return this.points[this.points.length - 1];
  }

  get points() {
    return this.points_;
  }

  length(): number {
    return this.bezierImpl.length();
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

  split(t: number): Split {
    const split = this.bezierImpl.split(t);
    return {
      left: new Bezier(...split.left.points),
      right: new Bezier(...split.right.points),
    };
  }

  bbox(): BBox {
    return this.bezierImpl.bbox();
  }
}

export interface Projection {
  x: number;
  y: number;
  t: number;
  d: number;
}

export interface Split {
  left: Bezier;
  right: Bezier;
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
