import { Point, Matrix } from '../common';
import { SubPath, Command, SvgChar } from '.';

/**
 * Defines the set of methods that are seen by the UI.
 */
export interface Path {

  /**
   * Returns the length of the path.
   */
  getPathLength(): number;

  /**
   * Returns the path's SVG path string.
   */
  getPathString(): string;

  /**
   * Returns the list of SubPaths in this path.
   */
  getSubPaths(): ReadonlyArray<SubPath>;

  /**
   * Returns the list of Commands in this path.
   */
  getCommands(): ReadonlyArray<Command>;

  /**
   * Interpolates this path between a start and end path using the specified fraction.
   * Does nothing if the paths are not morphable with each other.
   */
  interpolate(start: Path, end: Path, fraction: number): Path;

  /**
   * Returns true iff this path is morphable with the specified path.
   */
  isMorphableWith(path: Path): boolean;

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Also returns a 'split' function that can be used to split the path at the returned
   * projection point. Returns undefined if no point is found.
   */
  project(point: Point): { projection: Projection, splitFn: () => Path } | undefined;

  /**
   * Reverses the order of the points in the sub path at the specified index.
   * Returns a new path object.
   */
  reverse(subIdx: number): Path;

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   * Returns a new path object.
   */
  shiftBack(subIdx: number, numShifts?: number): Path;

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   * Returns a new path object.
   */
  shiftForward(subIdx: number, numShifts?: number): Path;

  /**
   * Splits the path at the specified index. Returns a new path object.
   */
  split(subIdx: number, cmdIdx: number, ...ts: number[]): Path;

  /**
   * Splits the path at the specified indices. Returns a new path object.
   */
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>): Path;

  /**
   * Splits the path at the specified index in half.
   */
  splitInHalf(subIdx: number, cmdIdx: number): Path;

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplit(subIdx: number, cmdIdx: number): Path;

  /**
   * Un-splits the path at the specified incides. Returns a new path object.
   */
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>): Path;

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convert(subIdx: number, cmdIdx: number, svgChar: SvgChar): Path;

  /**
   * Reverts any converts previously performed at the specified index.
   * Returns a new path object.
   */
  unconvertSubpath(subIdx: number): Path;

  /**
   * Returns the unique id associated with the cmomand at the specified index.
   */
  getId(subIdx: number, cmdIdx: number): string;

  /**
   * Returns a cloned instance of this path.
   */
  clone(): Path;

  /**
   * Returns the initial starting state of this path.
   */
  revert(): Path;

  /**
   * Transforms the path using the specified transformation matrices.
   * Returns a new path object.
   */
  transform(transforms: Matrix[]): Path;
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
