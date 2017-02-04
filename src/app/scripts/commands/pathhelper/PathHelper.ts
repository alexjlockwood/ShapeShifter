import * as _ from 'lodash';
import * as BezierJs from 'bezier-js';
import { MathUtil, Point } from '../../common';
import { SvgChar, Projection } from '..';
import { PointHelper } from './PointHelper';
import { LineHelper } from './LineHelper';
import { BezierHelper } from './BezierHelper';
import { Command } from '..';

/**
 * A wrapper around a backing SVG command that abstracts a lot of the math-y
 * path-related code from the rest of the application.
 */
export interface PathHelper {
  pathLength(): number;
  project(point: Point): Projection;
  split(t1: number, t2: number): PathHelper;
  convert(svgChar: SvgChar): PathHelper;
  findTimeByDistance(distance: number): number;
  toCommand(isSplit: boolean): Command;
}

export function newPathHelper(cmd: Command): PathHelper | undefined {
  if (cmd.svgChar === 'M') {
    // TODO: return a noop path helper instead or something?
    return undefined;
  }
  const points = cmd.points;
  const uniquePoints = _.uniqWith(points, (p1, p2) => p1.equals(p2));
  if (uniquePoints.length === 1) {
    return new PointHelper(cmd.svgChar, points[0]);
  }
  if (cmd.svgChar === 'L' || cmd.svgChar === 'Z' || uniquePoints.length === 2) {
    return new LineHelper(cmd.svgChar, _.first(points), _.last(points));
  }
  if (cmd.svgChar === 'Q') {
    return new BezierHelper(cmd.svgChar, points[0], points[1], points[2]);
  }
  if (cmd.svgChar === 'C') {
    return new BezierHelper(
      cmd.svgChar, cmd.points[0], cmd.points[1], cmd.points[2], cmd.points[3]);
  }
  // TODO: create an elliptical arc path helper some day?
  throw new Error('Invalid command type: ' + cmd.svgChar);
}
