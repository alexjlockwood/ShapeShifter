import { PathHelper } from '.';
import { Projection } from '..';
import { MathUtil, Point } from '../../common';
import { PointHelper } from './PointHelper';

export class LineHelper implements PathHelper {
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
    const a = x2 - x1;
    const b = y2 - y1;
    const dot = (x - x1) * a + (y - y1) * b;
    const lenSq = a * a + b * b;
    const param = lenSq === 0 ? -1 : dot / lenSq;
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * a;
      yy = y1 + param * b;
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
