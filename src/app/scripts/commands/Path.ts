import { Point } from '../common';
import { SubPath, Command } from '.';
import { ProjectionResult } from './calculators';
import { PathMutator } from './PathMutator';

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
   * Returns undefined if no point is found.
   */
  project(point: Point): { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined;

  /**
   * Splits the path at the specified indices. Returns a new path object.
   */
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>): Path;

  /**
   * Un-splits the path at the specified incides. Returns a new path object.
   */
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>): Path;

  /**
   * Returns the unique id associated with the command at the specified index.
   */
  getId(subIdx: number, cmdIdx: number): string;

  /**
   * Returns a cloned instance of this path.
   */
  clone(): Path;

  /**
   * Performs a hit test on the path and returns a HitResult.
   */
  hitTest(point: Point, opts?: HitOptions): HitResult;

  /**
   * Creates a builder that can create a mutated Path object.
   */
  mutate(): PathMutator;
}

/** Represents the options for a hit test. */
export interface HitOptions {
  isStrokeInRangeFn?: (distance: number) => boolean;
  isPointInRangeFn?: (distance: number, isSplit: boolean) => boolean;
  hitTestPointsOnly?: boolean;
}

/** Represents the result of a hit test. */
export interface HitResult {
  isHit: boolean;
  subIdx?: number;
  cmdIdx?: number;
}
