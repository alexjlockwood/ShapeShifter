import { PathHelper } from '.';
import { Projection } from '..';
import { MathUtil, Point } from '../../../common';

export class PointHelper implements PathHelper {
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
