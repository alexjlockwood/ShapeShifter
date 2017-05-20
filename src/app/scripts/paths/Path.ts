import * as _ from 'lodash';
import {
  SubPath, Command, Line, Projection,
  ProjectionOntoPath, HitOptions, HitResult,
} from '.';
import { PathMutator } from './PathMutator';
import { Point } from '../common';
import { PathState } from './PathState';
import * as PathParser from './PathParser';
import { environment } from '../../../environments/environment';

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
  getSubPath(subIdx: number): SubPath;

  /**
   * Returns the list of Commands in this path.
   */
  getCommands(): ReadonlyArray<Command>;

  /**
   * Returns the command at the specified index.
   */
  getCommand(subIdx: number, cmdIdx: number): Command;

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
   * Returns the number of intersection points of this path with the specified line segment.
   */
  intersects(line: Line): number;

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

export class Path {
  private readonly ps: PathState;
  private pathString: string;

  constructor(obj: string | Command[] | PathState) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      this.ps = new PathState(obj);
    } else {
      this.ps = obj;
    }
    if (!environment.production) {
      // Don't initialize variables lazily for dev builds (to avoid
      // ngrx-store-freeze crashes).
      this.getPathString();

      const allIds = this.getCommands().map(c => c.getId());
      const uniqueIds = new Set(allIds);
      const numCommands = allIds.length;
      if (uniqueIds.size !== numCommands) {
        const dumpInfo = this.getSubPaths().map((s, subIdx) => {
          return s.getCommands().map((c, cmdIdx) => {
            return {
              subIdx,
              cmdIdx,
              id: c.getId(),
              isDup: allIds.filter(id => id === c.getId()).length > 1,
            };
          });
        });
        console.warn('duplicate IDs found!', this, _.flatten(dumpInfo));
      }
    }
  }

  // Implements the Path interface.
  getPathString() {
    if (this.pathString === undefined) {
      this.pathString = PathParser.commandsToString(this.getCommands());
    }
    return this.pathString;
  }

  // Implements the Path interface.
  getSubPaths() {
    return this.ps.subPaths;
  }

  // Implements the Path interface.
  getSubPath(subIdx: number) {
    const numSubPaths = this.getSubPaths().length;
    if (subIdx < 0 || numSubPaths <= subIdx) {
      console.error(this);
      throw new Error(`Subpath index out of bounds: `
        + `subIdx=${subIdx} numSubPaths=${numSubPaths}`);
    }
    return this.getSubPaths()[subIdx];
  }

  // Implements the Path interface.
  getCommands() {
    return this.ps.commands;
  }

  // Implements the Path interface.
  getCommand(subIdx: number, cmdIdx: number) {
    const subPath = this.getSubPath(subIdx);
    const numCommands = subPath.getCommands().length;
    if (cmdIdx < 0 || numCommands <= cmdIdx) {
      console.error(this);
      throw new Error(`Command index out of bounds: `
        + `subIdx=${subIdx} cmdIdx=${cmdIdx}, numCommands=${numCommands}`);
    }
    return subPath.getCommands()[cmdIdx];
  }

  // Implements the Path interface.
  getPathLength() {
    return this.ps.getPathLength();
  }

  // Implements the Path interface.
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return cmds1.length === cmds2.length && cmds1.every((cmd1, i) =>
      cmd1.getSvgChar() === cmds2[i].getSvgChar());
  }

  // Implements the Path interface.
  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    return this.ps.project(point, restrictToSubIdx);
  }

  // Implements the Path interface.
  hitTest(point: Point, opts: HitOptions): HitResult {
    return this.ps.hitTest(point, opts);
  }

  // Implements the Path interface.
  intersects(line: Line) {
    return this.ps.intersects(line);
  }

  // Implements the Path interface.
  getPoleOfInaccessibility(subIdx: number) {
    return this.ps.getPoleOfInaccessibility(subIdx);
  }

  // Implements the Path interface.
  mutate() {
    return new PathMutator(this.ps);
  }

  // Implements the Path interface.
  clone() {
    return this.mutate().build();
  }

  // Implements the Path interface.
  revert() {
    return this.mutate().revert().build();
  }
}

/** Represents the options for a hit test. */
export interface HitOptions {
  isPointInRangeFn?: (distance: number, cmd?: Command) => boolean;
  isSegmentInRangeFn?: (distance: number, cmd?: Command) => boolean;
  findShapesInRange?: boolean;
  restrictToSubIdx?: number[];
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
  readonly projection: Projection;
}
