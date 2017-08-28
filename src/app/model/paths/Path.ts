import { Matrix, Point } from 'app/scripts/common';
import { environment } from 'environments/environment';
import * as _ from 'lodash';

import { Line, Projection } from './calculators';
import { Command } from './Command';
import { PathMutator } from './PathMutator';
import * as PathParser from './PathParser';
import { PathState } from './PathState';

/**
 * A compound path that contains all of the information associated with a
 * PathLayer's pathData attribute.
 */
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

  /**
   * Returns the path's SVG path string.
   */
  getPathString() {
    if (this.pathString === undefined) {
      this.pathString = PathParser.commandsToString(this.getCommands());
    }
    return this.pathString;
  }

  /**
   * Returns the list of SubPaths in this path.
   */
  getSubPaths() {
    return this.ps.subPaths;
  }

  /**
   * Returns the subpath at the specified index.
   */
  getSubPath(subIdx: number) {
    const numSubPaths = this.getSubPaths().length;
    if (subIdx < 0 || numSubPaths <= subIdx) {
      console.error(this);
      throw new Error(
        `Subpath index out of bounds: ` + `subIdx=${subIdx} numSubPaths=${numSubPaths}`,
      );
    }
    return this.getSubPaths()[subIdx];
  }

  /**
   * Returns the list of Commands in this path.
   */
  getCommands() {
    return this.ps.commands;
  }

  /**
   * Returns the command at the specified index.
   */
  getCommand(subIdx: number, cmdIdx: number) {
    const subPath = this.getSubPath(subIdx);
    const numCommands = subPath.getCommands().length;
    if (cmdIdx < 0 || numCommands <= cmdIdx) {
      console.error(this);
      throw new Error(
        `Command index out of bounds: ` +
          `subIdx=${subIdx} cmdIdx=${cmdIdx}, numCommands=${numCommands}`,
      );
    }
    return subPath.getCommands()[cmdIdx];
  }

  /**
   * Returns the length of the path.
   */
  getPathLength() {
    return this.ps.getPathLength();
  }

  /**
   * Returns the length of the subpath.
   */
  getSubPathLength(subIdx: number) {
    return this.ps.getSubPathLength(subIdx);
  }

  /**
   * Returns the point at the given length along the path.
   */
  getPointAtLength(distance: number) {
    return this.ps.getPointAtLength(distance);
  }

  /**
   * Returns true iff this path is morphable with the specified path.
   */
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return (
      cmds1.length === cmds2.length &&
      cmds1.every((cmd1, i) => cmd1.getSvgChar() === cmds2[i].getSvgChar())
    );
  }

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Returns undefined if no point is found.
   */
  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    return this.ps.project(point, restrictToSubIdx);
  }

  /**
   * Performs a hit test on the path and returns a HitResult.
   */
  hitTest(point: Point, opts: HitOptions): HitResult {
    return this.ps.hitTest(point, opts);
  }

  /**
   * Returns the pole of inaccessibility for the specified subpath index.
   */
  getPoleOfInaccessibility(subIdx: number) {
    return this.ps.getPoleOfInaccessibility(subIdx);
  }

  /**
   * Returns the bounding box for this path.
   */
  getBoundingBox() {
    return this.ps.getBoundingBox();
  }

  /**
   * Returns true iff the subpath at the specified index is clockwise.
   */
  isClockwise(subIdx: number) {
    return this.ps.isClockwise(subIdx);
  }

  /**
   * Transforms the path using the specified transform matrix.
   */
  transform(transform: Matrix) {
    return this.mutate().transform(transform).build().clone();
  }

  /**
   * Creates a builder that can create a mutated Path object.
   */
  mutate() {
    return new PathMutator(this.ps);
  }

  /**
   * Returns a cloned instance of this path. Any existing path state will be cleared.
   */
  clone() {
    return new Path(this.getPathString());
  }

  /**
   * Returns a Path representing its initial unmutated state.
   */
  revert() {
    return this.mutate().revert().build();
  }
}

/** Represents the options for a hit test. */
export interface HitOptions {
  readonly isPointInRangeFn?: (distance: number, cmd?: Command) => boolean;
  readonly isSegmentInRangeFn?: (distance: number, cmd?: Command) => boolean;
  readonly findShapesInRange?: boolean;
  readonly restrictToSubIdx?: ReadonlyArray<number>;
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
