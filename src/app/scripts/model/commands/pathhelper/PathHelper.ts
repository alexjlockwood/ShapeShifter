import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { MathUtil, Point } from '../../../common';
import { Projection } from '..';
import { PointHelper } from './PointHelper';
import { LineHelper } from './LineHelper';
import { BezierHelper } from './BezierHelper';

export interface PathHelper {
  points: ReadonlyArray<Point>;
  pathLength(): number;
  project(point: Point): Projection;
  split(t1: number, t2?: number): PathHelper;
  findTimeByDistance(distance: number): number;
}

// TODO: create an elliptical arc path helper
export function createPathHelper(...points: Point[]): PathHelper {
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
