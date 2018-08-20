import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import { Line } from 'app/modules/editor/store/paper/actions';
import * as _ from 'lodash';

export class SnapBounds {
  readonly snapPoints: ReadonlyArray<Point>;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;

  constructor(...snapPoints: Point[]) {
    this.snapPoints = snapPoints;
    this.left = _.minBy(snapPoints, p => p.x).x;
    this.top = _.minBy(snapPoints, p => p.y).y;
    this.right = _.maxBy(snapPoints, p => p.x).x;
    this.bottom = _.maxBy(snapPoints, p => p.y).y;
    this.width = this.right - this.left;
    this.height = this.bottom - this.top;
  }

  /** Computes the minimum distance between two snap bounds. */
  distance(sb: SnapBounds): Readonly<{ line: Line; dist: number }> {
    const { left: l1, top: t1, right: r1, bottom: b1 } = this;
    const { left: l2, top: t2, right: r2, bottom: b2 } = sb;
    const left = r2 < l1;
    const top = b1 < t2;
    const right = r1 < l2;
    const bottom = b2 < t1;
    let line: Line;
    if (top && left) {
      line = { from: { x: l1, y: b1 }, to: { x: r2, y: t2 } };
    } else if (left && bottom) {
      line = { from: { x: l1, y: t1 }, to: { x: r2, y: b2 } };
    } else if (bottom && right) {
      line = { from: { x: r1, y: t1 }, to: { x: l2, y: b2 } };
    } else if (right && top) {
      line = { from: { x: r1, y: b1 }, to: { x: l2, y: t2 } };
    } else if (left) {
      line = { from: { x: r2, y: t1 }, to: { x: l1, y: t1 } };
    } else if (right) {
      line = { from: { x: r1, y: t1 }, to: { x: l2, y: t1 } };
    } else if (bottom) {
      line = { from: { x: l1, y: b2 }, to: { x: l1, y: t1 } };
    } else if (top) {
      line = { from: { x: l1, y: b1 }, to: { x: l1, y: t2 } };
    } else {
      // TODO: handle this case better? (it implies the bounds intersect)
      line = { from: { x: l1, y: t1 }, to: { x: l1, y: t1 } };
    }
    return { line, dist: MathUtil.distance(line.from, line.to) };
  }
}
