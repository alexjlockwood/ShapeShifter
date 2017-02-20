import * as _ from 'lodash';
import { Point } from '../../common';
import { SvgChar, Projection } from '..';
import { PointMutator } from './PointMutator';
import { LineMutator } from './LineMutator';
import { BezierMutator } from './BezierMutator';
import { CommandImpl } from '../CommandImpl';

/**
 * A wrapper around a backing SVG command that abstracts a lot of the math-y
 * path-related code from the rest of the application.
 */
export interface Mutator {
  pathLength(): number;
  project(point: Point): Projection;
  split(t1: number, t2: number): Mutator;
  convert(svgChar: SvgChar): Mutator;
  findTimeByDistance(distance: number): number;
  toCommand(isSplit: boolean): CommandImpl;
}

export function newMutator(cmd: CommandImpl): Mutator | undefined {
  if (cmd.svgChar === 'M') {
    // TODO: return a noop path helper instead or something?
    return undefined;
  }
  const points = cmd.points;
  const uniquePoints = _.uniqWith(points, (p1, p2) => p1.equals(p2));
  if (uniquePoints.length === 1) {
    return new PointMutator(cmd.svgChar, points[0]);
  }
  if (cmd.svgChar === 'L' || cmd.svgChar === 'Z' || uniquePoints.length === 2) {
    return new LineMutator(cmd.svgChar, _.first(points), _.last(points));
  }
  if (cmd.svgChar === 'Q') {
    return new BezierMutator(cmd.svgChar, points[0], points[1], points[2]);
  }
  if (cmd.svgChar === 'C') {
    return new BezierMutator(
      cmd.svgChar, cmd.points[0], cmd.points[1], cmd.points[2], cmd.points[3]);
  }
  // TODO: create an elliptical arc path helper some day?
  throw new Error('Invalid command type: ' + cmd.svgChar);
}
