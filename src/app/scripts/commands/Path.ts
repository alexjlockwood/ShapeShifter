import { Point } from '../common';
import { SubPath, Command } from '.';
import { ProjectionResult } from './calculators';
import { PathMutator } from './PathMutator';

/**
 * Defines a set of sub paths with numerous methods to perform important calculations.
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
   * Returns true iff this path is morphable with the specified path.
   */
  isMorphableWith(path: Path): boolean;

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Returns undefined if no point is found.
   */
  project(point: Point): ProjectionOntoPath | undefined;

  /**
   * Returns a cloned instance of this path.
   */
  clone(): Path;

  /**
   * Performs a hit test on the path and returns a HitResult.
   */
  hitTest(point: Point, opts?: HitOptions): HitResult;

  /**
   * Returns the pole of inaccessibility for the specified subpath index.
   */
  getPoleOfInaccessibility(subIdx: number): Point;

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

export interface ProjectionOntoPath {
  subIdx: number;
  cmdIdx: number;
  projection: ProjectionResult;
}
