import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import _ from 'lodash';

import { Command, SvgChar } from '..';
import { isPoint } from '../Command';
import { BezierCalculator } from './BezierCalculator';
import { LineCalculator } from './LineCalculator';
import { MoveCalculator } from './MoveCalculator';
import { PointCalculator } from './PointCalculator';

/**
 * A wrapper around a backing SVG command that abstracts a lot of the math-y
 * path-related code from the rest of the application.
 */
export interface Calculator {
  getPathLength(): number;
  getPointAtLength(distance: number): Point;
  project(point: Point): Projection | undefined;
  split(t1: number, t2: number): Calculator;
  convert(svgChar: SvgChar): Calculator;
  findTimeByDistance(distance: number): number;
  toCommand(): Command;
  getBoundingBox(): BBox;
  intersects(line: Line): number[];
}

export function newCalculator(cmd: Command): Calculator {
  if (cmd.type === 'M') {
    return new MoveCalculator(cmd.id, cmd.start, cmd.end);
  }
  // Only a move can be missing its start point.
  const points = cmd.points.filter(isPoint);
  const uniquePoints: Point[] = _.uniqWith(points, MathUtil.arePointsEqual);
  if (uniquePoints.length === 1) {
    return new PointCalculator(cmd.id, cmd.type, points[0]);
  }
  if (cmd.type === 'L' || cmd.type === 'Z' || uniquePoints.length === 2) {
    return new LineCalculator(cmd.id, cmd.type, points[0], points[points.length - 1]);
  }
  if (cmd.type === 'Q') {
    return new BezierCalculator(cmd.id, cmd.type, points[0], points[1], points[2]);
  }
  if (cmd.type === 'C') {
    return new BezierCalculator(cmd.id, cmd.type, points[0], points[1], points[2], points[3]);
  }
  throw new Error('Invalid command type: ' + cmd.type);
}

/** Represents a projection onto a path. */
export interface Projection {
  /** The x-coordinate of the point on the path. */
  x: number;
  /** The y-coordinate of the point on the path. */
  y: number;
  /** The t-value of the point on the path. */
  t: number;
  /** The distance of the source point to the point on the path. */
  d: number;
}

/** Represents a rectangular bounding box. */
export interface BBox {
  x: MinMax;
  y: MinMax;
}

interface MinMax {
  min: number;
  max: number;
}

/** Represents a 2D line. */
export interface Line {
  p1: Point;
  p2: Point;
}
