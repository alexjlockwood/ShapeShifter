import * as BezierImpl from 'bezier-js';
import { Point } from './mathutil';

const s = new BezierImpl(0, 1, 2, 3, 4, 5);

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
