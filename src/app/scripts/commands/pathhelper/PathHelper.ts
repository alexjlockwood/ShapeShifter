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

// TODO: create an elliptical arc path helper
export function newPathHelper(cmd: Command): PathHelper | undefined {
  if (cmd.svgChar === 'M') {
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
  throw new Error('Invalid command type: ' + cmd.svgChar);
}

// const [
//   currentPointX, currentPointY,
//   rx, ry, xAxisRotation,
//   largeArcFlag, sweepFlag,
//   endX, endY] = cmd.args;
// if (currentPointX === endX && currentPointY === endY) {
//   // Degenerate to point.
//   return createPathHelper({ x: endX, y: endY });
// }
// if (rx === 0 || ry === 0) {
//   // Degenerate to line.
//   const start = cmd.start;
//   const cp = new Point(
//     MathUtil.lerp(cmd.end.x, cmd.start.x, 0.5),
//     MathUtil.lerp(cmd.end.y, cmd.start.y, 0.5));
//   const end = cmd.end;
//   return createPathHelper(start, cp, cp, end);
// }
// const bezierCoords = SvgUtil.arcToBeziers({
//   startX: currentPointX,
//   startY: currentPointY,
//   rx, ry, xAxisRotation,
//   largeArcFlag, sweepFlag,
//   endX, endY,
// });
// const arcBeziers: PathHelper[] = [];
// for (let i = 0; i < bezierCoords.length; i += 8) {
//   const bez = createPathHelper(
//     { x: cmd.start.x, y: cmd.start.y },
//     { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
//     { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
//     { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
//   arcBeziers.push(bez);
// }
// return arcBeziers;
