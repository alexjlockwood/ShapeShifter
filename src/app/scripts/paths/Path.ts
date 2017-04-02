import { Point } from '../common';
import { SubPath, Command } from '.';
import { ProjectionResult } from './calculators';
import { PathMutator } from './PathMutator';

/**
 * A compound path that contains all of the information associated with a
 * PathLayer's pathData attribute.
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
   * Returns the subpath at the specified index.
   */
  getSubPath(subIdx: number);

  /**
   * Returns the list of Commands in this path.
   */
  getCommands(): ReadonlyArray<Command>;

  /**
   * Returns the command at the specified index.
   */
  getCommand(subIdx: number, cmdIdx: number);

  /**
   * Returns true iff this path is morphable with the specified path.
   */
  isMorphableWith(path: Path): boolean;

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Returns undefined if no point is found.
   */
  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined;

  /**
   * Performs a hit test on the path and returns a HitResult.
   */
  hitTest(point: Point, opts: HitOptions): HitResult;

  /**
   * Returns the pole of inaccessibility for the specified subpath index.
   */
  getPoleOfInaccessibility(subIdx: number): Point;

  /**
   * Creates a builder that can create a mutated Path object.
   */
  mutate(): PathMutator;

  /**
   * Returns a cloned instance of this path.
   */
  clone(): Path;

  /**
   * Returns a Path representing its initial unmutated state.
   */
  revert(): Path;
}

/** Represents the options for a hit test. */
export interface HitOptions {
  isPointInRangeFn?: (distance: number, cmd?: Command) => boolean;
  isSegmentInRangeFn?: (distance: number, cmd?: Command) => boolean;
  findShapesInRange?: boolean;
  restrictToSubIdx?: number;
}

/** Represents the result of a hit test. */
export interface HitResult {
  readonly isHit: boolean;
  readonly isEndPointHit: boolean;
  readonly isSegmentHit: boolean;
  readonly isShapeHit: boolean;
  readonly endPointHits?: ReadonlyArray<ProjectionOntoPath>;
  readonly segmentHits?: ReadonlyArray<ProjectionOntoPath>;
  readonly shapeHits?: Array<{ subIdx: number }>;
}

export interface ProjectionOntoPath {
  readonly subIdx: number;
  readonly cmdIdx: number;
  readonly projection: ProjectionResult;
}
