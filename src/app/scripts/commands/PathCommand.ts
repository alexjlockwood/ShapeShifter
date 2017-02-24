import { Point } from '../common';
import { SubPathCommand, SvgChar } from '.';

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
  reverse(subIdx: number): PathCommand;

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftBack(subIdx: number, numShifts?: number): PathCommand;

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   * Returns a new path command object.
   */
  shiftForward(subIdx: number, numShifts?: number): PathCommand;

  /**
   * Splits the command at the specified index.
   * Returns a new path command object.
   */
  split(subIdx: number, cmdIdx: number, ...ts: number[]): PathCommand;

  /**
   * Splits the command at the specified indices.
   * Returns a new path command object.
   */
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>): PathCommand;

  /**
   * Splits the command at the specified index in half.
   */
  splitInHalf(subIdx: number, cmdIdx: number): PathCommand;

  /**
   * Un-splits the command at the specified index.
   * Returns a new path command object.
   */
  unsplit(subIdx: number, cmdIdx: number): PathCommand;

  /**
   * Un-splits the command at the specified incides.
   * Returns a new path command object.
   */
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>): PathCommand;

  /**
   * Convert the command at the specified index.
   * Returns a new path command object.
   */
  convert(subIdx: number, cmdIdx: number, svgChar: SvgChar): PathCommand;

  /**
   * Converts the command at the specified indices.
   * Returns a new path command object.
   */
  convertBatch(ops: Array<{ subIdx: number, cmdIdx: number, svgChar: SvgChar }>): PathCommand;

  /**
   * Reverts any converts previously performed at the specified index.
   * Returns a new path command object.
   */
  unconvert(subIdx: number): PathCommand;

  /**
   * Returns the unique id associated with the cmomand at the
   * specified index.
   */
  getId(subIdx: number, cmdIdx: number): string;

  /**
   * Returns a cloned instance of this path command.
   */
  clone(): PathCommand;

  /**
   * Returns the initial starting state of this path command.
   */
  revert(): PathCommand;
}

/** Represents a projection onto a path. */
export interface Projection {
  x: number;
  y: number;
  t: number;
  d: number;
}
