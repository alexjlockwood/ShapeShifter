import { Command } from '.';
import { Point } from '../common';

/**
 * Defines the set of methods that are seen by the sub path inspector/canvas.
 */
export interface SubPathCommand {

  /**
   * The list of children commands in this sub path.
   */
  commands: ReadonlyArray<Command>;

  /**
   * Returns true iff the sub path's start point is equal to its end point.
   */
  isClosed: boolean;

  /**
   * Returns the list of points in this sub path in sequential order. The list of
   * points does not include control points.
   */
  points: ReadonlyArray<{ point: Point, isSplit: boolean }>;
}
