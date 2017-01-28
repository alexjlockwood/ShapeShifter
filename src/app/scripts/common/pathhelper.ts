import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { MathUtil, Point } from './';

export interface PathHelper {
  points: ReadonlyArray<Point>;
  pathLength(): number;
  project(point: Point): Projection;
  split(t1: number, t2?: number): PathHelper;
  findTimeByDistance(distance: number): number;
}

export interface Projection {
  x: number;
  y: number;
  t: number;
  d: number;
}

interface IPoint { x: number; y: number; };

// TODO: create an elliptical arc path helper
export function createPathHelper(...points: IPoint[]): PathHelper {
  if (!points.length || 4 < points.length) {
    throw new Error('Invalid number of points: ' + points.length);
  }
  // TODO: remove duplicate points?
  // TODO: check if points are collinear?
  // const newPoints: Point[] = _.uniqWith(
  //  points.map(p => new Point(p.x, p.y)), (p1, p2) => p1.equals(p2));
  const newPoints = points.map(p => new Point(p.x, p.y));
  if (newPoints.length === 1) {
    return new PointHelper(newPoints[0]);
  } else if (newPoints.length === 2) {
    return new LineHelper(newPoints[0], newPoints[1]);
  } else if (newPoints.length === 3) {
    // if (MathUtil.areCollinear(...newPoints)) {
      // TODO: is it possible for the second point to be
      // smaller/larger than the first/third? does that cause issues?
    //  return new LineHelper(newPoints[0], newPoints[2]);
    // }
  } else if (newPoints.length === 4) {
    // if (MathUtil.areCollinear(...newPoints)) {
      // TODO: is it possible for the second/third points to be
      // smaller/larger than the first/fourth? does that cause issues?
    //  return new LineHelper(newPoints[0], newPoints[3]);
    // }
  }
  return new BezierHelper(...newPoints);
}

class PointHelper implements PathHelper {
  private readonly points_: ReadonlyArray<Point>;

  constructor(point: Point) {
    this.points_ = [point];
  }

  get points() {
    return this.points_;
  }

  pathLength() {
    return 0;
  }

  project(point: Point): Projection {
    const x = this.points[0].x;
    const y = this.points[0].y;
    const t = 0.5;
    const d = MathUtil.distance(this.points[0], point);
    return { x, y, t, d };
  }

  split(t1: number, t2: number): PathHelper {
    return new PointHelper(this.points[0]);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }
}

class LineHelper implements PathHelper {
  private readonly points_: ReadonlyArray<Point>;

  constructor(p1: Point, p2: Point) {
    this.points_ = [p1, p2];
  }

  get points() {
    return this.points_;
  }

  pathLength() {
    return MathUtil.distance(this.points[0], this.points[1]);
  }

  project({x, y}: Point): Projection {
    const {x: x1, y: y1} = this.points[0];
    const {x: x2, y: y2} = this.points[1];
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq === 0 ? -1 : dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    const dx = x - xx;
    const dy = y - yy;
    const dd = Math.sqrt(dx * dx + dy * dy);
    let dt;
    if (x2 !== x1) {
      dt = (xx - x1) / (x2 - x1);
    } else if (y2 !== y1) {
      dt = (yy - y1) / (y2 - y1);
    } else {
      dt = 0.5;
    }
    return {
      x: xx,
      y: yy,
      d: dd,
      t: dt,
    };
  }

  split(t1: number, t2: number): PathHelper {
    const {x: x1, y: y1} = this.points[0];
    const {x: x2, y: y2} = this.points[1];
    const p1 = new Point(
      MathUtil.lerp(x1, x2, t1),
      MathUtil.lerp(y1, y2, t1));
    const p2 = new Point(
      MathUtil.lerp(x1, x2, t2),
      MathUtil.lerp(y1, y2, t2));
    if (p1.equals(p2)) {
      return new PointHelper(p1);
    }
    return new LineHelper(p1, p2);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }
}

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
class BezierHelper implements PathHelper {
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
    return new BezierHelper(...this.bezierJs.split(t1, t2).points);
  }

  findTimeByDistance(distance: number): number {
    // TODO: check for degenerate curves?
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
      throw new Error('could not find the midpoint!');
    }

    return distance;
  }
}
