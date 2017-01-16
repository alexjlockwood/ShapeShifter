import { Point, Projection } from '../common';

/** Defines the set of methods that are seen by the path inspector/canvas. */
export interface PathCommand {

  /** The list of children sub path commands in this path. */
  commands: ReadonlyArray<SubPathCommand>;

  /** Returns the length of the path. */
  pathLength: number;

  /**
   * Interpolates this path between a start and end path using the specified fraction.
   * Does nothing if the paths are not morphable with each other.
   */
  interpolate(start: PathCommand, end: PathCommand, fraction: number): void;

  /** Returns true iff this path is morphable with the specified path command. */
  isMorphableWith(cmd: PathCommand): boolean;

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Also returns a 'split' function that can be used to split the path at the returned
   * projection point.
   */
  project(point: Point): { projection: Projection, split: () => PathCommand } | undefined;

  /**
   * Reverses the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  reverse(subPathIndex: number): PathCommand;

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftBack(subPathIndex: number): PathCommand;

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftForward(subPathIndex: number): PathCommand;

  /**
   * Splits the draw command at the specified index.
   * Returns a new path command object.
   */
  // split(subPathIndex: number, drawIndex: number): IPathCommand;

  /**
   * Un-splits the draw command at the specified index.
   * Returns a new path command object.
   */
  unsplit(subPathIndex: number, drawIndex: number): PathCommand;
}

/** Defines the set of methods that are seen by the sub path inspector/canvas. */
export interface SubPathCommand {

  /** The list of children draw commands in this sub path. */
  commands: ReadonlyArray<DrawCommand>;

  /** Returns true iff the sub path's start point is equal to its end point. */
  isClosed: boolean;

  /**
   * Returns the list of points in this sub path in sequential order. The list of
   * points does not include control points.
   */
  points: ReadonlyArray<{point: Point, isSplit: boolean}>;
}

/** Defines the set of methods that are seen by the command inspector/canvas. */
export interface DrawCommand {

  /** Returns the SVG character for this draw command. */
  svgChar: string;

  /** Returns the raw number arguments for this draw command. */
  args: ReadonlyArray<number>;

  /** Returns the points for this draw command. */
  points: ReadonlyArray<Point>;

  /**
   * Returns true iff the draw command was created as a result of being split.
   * Only split commands are able to be editted and deleted via the inspector/canvas.
   */
  isSplit: boolean;
}
