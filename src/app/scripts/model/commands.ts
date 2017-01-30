import { Point } from '../common';
import { Projection } from '../svg';

// The different types of supported SVG commands.
export type SvgChar = 'M' | 'L' | 'Q' | 'C' | 'A' | 'Z';

/**
 * Defines the set of methods that are seen by the path inspector/canvas.
 */
export interface PathCommand {

  /**
   * Returns the list of sub path commands in this path.
   */
  subPathCommands: ReadonlyArray<SubPathCommand>;

  /**
   * Returns the length of the path.
   */
  pathLength: number;

  /**
   * Returns the path's SVG path string.
   */
  pathString: string;

  /**
   * Interpolates this path between a start and end path using the specified fraction.
   * Does nothing if the paths are not morphable with each other.
   */
  interpolate(start: PathCommand, end: PathCommand, fraction: number): PathCommand;

  /**
   * Returns true iff this path is morphable with the specified path command.
   */
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
  reverse(subPathIdx: number): PathCommand;

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftBack(subPathIdx: number, numShifts?: number): PathCommand;

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftForward(subPathIdx: number, numShifts?: number): PathCommand;

  /**
   * Splits the draw command at the specified index.
   * Returns a new path command object.
   */
  split(subPathIdx: number, drawIdx: number, ...ts: number[]): PathCommand;

  /** Splits the draw command at the specified index in half. */
  splitInHalf(subPathIdx: number, drawIdx: number): PathCommand;

  /**
   * Un-splits the draw command at the specified index.
   * Returns a new path command object.
   */
  unsplit(subPathIdx: number, drawIdx: number): PathCommand;

  /**
   * Convert the draw command at the specified index.
   * Returns a new path command object.
   */
  convert(subPathIdx: number, drawIdx: number, svgChar: SvgChar): PathCommand;

  /**
   * Returns the unique id associated with the draw cmomand at the
   * specified index.
   */
  getId(subPathIdx: number, drawIdx: number): string;

  /**
   * Returns a cloned instance of this path command.
   */
  clone(): PathCommand;
}

/**
 * Defines the set of methods that are seen by the sub path inspector/canvas.
 */
export interface SubPathCommand {

  /**
   * The list of children draw commands in this sub path.
   */
  commands: ReadonlyArray<DrawCommand>;

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

/**
 * Defines the set of methods that are seen by the command inspector/canvas.
 */
export interface DrawCommand {

  /**
   * Returns the SVG character for this draw command.
   */
  svgChar: SvgChar;

  /**
   * A human-readable representation of this command.
   */
  commandString: string;

  /**
   * Returns the raw number arguments for this draw command.
   */
  args: ReadonlyArray<number>;

  /**
   * Returns the points for this draw command.
   */
  points: ReadonlyArray<Point>;

  /**
   * Returns the command's starting point.
   */
  start: Point;

  /**
   * Returns the command's ending point.
   */
  end: Point;

  /**
   * Returns true iff the draw command was created as a result of being split.
   * Only split commands are able to be editted and deleted via the inspector/canvas.
   */
  isSplit: boolean;

  /**
   * Returns true iff this draw command can be converted into a new command
   * that is morphable with the specified SVG command type.
   */
  canConvertTo(ch: SvgChar): boolean;
}

/**
 * Uniquely identifies a draw command in a path.
 */
export interface CommandId {
  readonly pathId: string;
  readonly subPathIdx: number;
  readonly drawIdx: number;
}
