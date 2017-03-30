import * as _ from 'lodash';
import { SubPath, Command, ProjectionOntoPath, HitOptions, HitResult } from '.';
import { createSubPaths } from './SubPathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Point, Rect } from '../common';
import * as PathParser from './PathParser';
import * as polylabel from 'polylabel';
import {
  SubPathState,
  findSubPathState,
  isSubPathSplit,
  isSubPathUnsplittable,
} from './SubPathState';

/**
 * Container class that encapsulates a Path's underlying state.
 */
export class PathState {
  readonly subPaths: ReadonlyArray<SubPath>;
  readonly commands: ReadonlyArray<Command>;

  constructor(
    private readonly obj: string | Command[],
    // Maps internal spsIdx indices to SubPathState objects. The last 'numCollapsingSubPaths'
    // indices hold references to the collapsing sub paths.
    public readonly subPathStateMap?: ReadonlyArray<SubPathState>,
    // Maps client-visible subIdx values to their positions in the subPathStateMap.
    public readonly subPathOrdering?: ReadonlyArray<number>,
    // The number of collapsing subpaths appended to the end of the subPathStateMap.
    public readonly numCollapsingSubPaths = 0,
  ) {
    const commands = (typeof obj === 'string' ? PathParser.parseCommands(obj) : obj);
    const subPaths = createSubPaths(commands);
    this.subPathStateMap =
      subPathStateMap || subPaths.map(s => {
        return new SubPathState(s.getCommands().map(c => new CommandState(c)));
      });
    this.subPathOrdering = subPathOrdering || subPaths.map((_, i) => i);
    this.subPaths = subPaths.map((subPath, subIdx) => {
      const cmds = subPath.getCommands().map((cmd, cmdIdx) => {
        return cmd.mutate()
          .setId(this.findCommandStateId(subIdx, cmdIdx))
          .build();
      });
      const spsIdx = this.subPathOrdering[subIdx];
      const isCollapsing =
        this.subPathOrdering.length - this.numCollapsingSubPaths <= spsIdx;
      const sps = findSubPathState(this.subPathStateMap, spsIdx);
      const isSplit = isSubPathSplit(this.subPathStateMap, spsIdx);
      const isUnsplittable = isSubPathUnsplittable(this.subPathStateMap, spsIdx);
      return subPath.mutate()
        .setId(sps.id)
        .setCommands(cmds)
        .setIsCollapsing(isCollapsing)
        .setIsReversed(sps.isReversed)
        .setShiftOffset(sps.shiftOffset)
        .setIsSplit(isSplit)
        .setIsUnsplittable(isUnsplittable)
        .build();
    });
    this.commands = _.flatMap(this.subPaths, subPath => subPath.getCommands() as Command[]);
  }

  private findSubPathState(spsIdx: number) {
    return findSubPathState(this.subPathStateMap, spsIdx);
  }

  private findCommandStateId(subIdx: number, cmdIdx: number) {
    const sps = this.findSubPathState(this.subPathOrdering[subIdx]);
    const numCommandsInSubPath =
      _.sum(sps.commandStates.map(cs => cs.getCommands().length));
    if (cmdIdx && sps.isReversed) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.shiftOffset;
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting numCommandsInSubPath is intentional here
      // (as opposed to subtracting numCommandsInSubPath - 1).
      cmdIdx -= numCommandsInSubPath;
    }
    let counter = 0;
    for (const cs of sps.commandStates) {
      if (counter + cs.getCommands().length > cmdIdx) {
        return cs.getIdAtIndex(cmdIdx - counter);
      }
      counter += cs.getCommands().length;
    }
    throw new Error('Error retrieving command mutation');
  }

  getPathLength() {
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    const sps = this.findSubPathState(this.subPathOrdering[0]);
    return _.sum(sps.commandStates.map(cs => cs.getPathLength()));
  }

  project(point: Point): ProjectionOntoPath | undefined {
    const minProjectionResultInfo =
      _.chain(this.subPaths as SubPath[])
        .filter(subPath => !subPath.isCollapsing())
        .map((subPath, subIdx) => {
          const spsIdx = this.subPathOrdering[subIdx];
          const sps = this.findSubPathState(spsIdx);
          return sps.commandStates
            .map((cs, csIdx) => {
              const projection = cs.project(point);
              if (projection && sps.isReversed) {
                const t = projection.projectionResult.t;
                projection.projectionResult.t = 1 - t;
              }
              return {
                spsIdx,
                csIdx,
                splitIdx: projection ? projection.splitIdx : 0,
                projection: projection ? projection.projectionResult : undefined,
              };
            });
        })
        .flatMap(projections => projections)
        .filter(obj => !!obj.projection)
        // Reverse so that commands drawn with higher z-orders are preferred.
        .reverse()
        .reduce((prev, curr) => {
          return prev && prev.projection.d < curr.projection.d ? prev : curr;
        }, undefined)
        .value();
    if (!minProjectionResultInfo) {
      return undefined;
    }
    const { spsIdx, csIdx, splitIdx, projection } = minProjectionResultInfo;
    const subIdx = this.toSubIdx(spsIdx);
    const cmdIdx = this.toCmdIdx(spsIdx, csIdx, splitIdx);
    return { projection, subIdx, cmdIdx };
  }

  hitTest(point: Point, opts: HitOptions): HitResult {
    if (opts.isPointInRangeFn) {
      // First search for in-range path points.
      const pointResult =
        _.chain(this.subPaths as SubPath[])
          .filter(subPath => !subPath.isCollapsing())
          .map((subPath, subIdx) => {
            return subPath.getCommands()
              .map((cmd, cmdIdx) => {
                const distance = MathUtil.distance(cmd.getEnd(), point);
                const isSplit = cmd.isSplit();
                return { subIdx, cmdIdx, distance, isSplit };
              });
          })
          .flatMap(pathPoints => pathPoints)
          .filter(pathPoint => opts.isPointInRangeFn(pathPoint.distance, pathPoint.isSplit))
          // Reverse so that points drawn with higher z-orders are preferred.
          .reverse()
          .reduce((prev, curr) => {
            if (!prev) {
              return curr;
            }
            if (prev.isSplit !== curr.isSplit) {
              // Always return split points that are in range before
              // returning non-split points. This way we can guarantee that
              // split points will never be obstructed by non-split points.
              return prev.isSplit ? prev : curr;
            }
            return prev.distance < curr.distance ? prev : curr;
          }, undefined)
          .value();

      if (pointResult) {
        // Then the hit occurred on top of a command point.
        return {
          isHit: true,
          subIdx: pointResult.subIdx,
          cmdIdx: pointResult.cmdIdx,
        };
      }
    }

    if (opts.hitTestPointsOnly) {
      return { isHit: false };
    }

    if (opts.isStrokeInRangeFn) {
      // TODO: also check to see if the hit occurred at a stroke-linejoin vertex
      // TODO: take stroke width scaling into account as well?
      const result = this.project(point);
      const isHit = result && opts.isStrokeInRangeFn(result.projection.d);
      return {
        isHit,
        subIdx: isHit ? result.subIdx : undefined,
      };
    }

    let hitSpsIdx: number = undefined;

    // Search from right to left so that higher z-order subpaths are found first.
    _.chain(this.subPaths as SubPath[])
      .filter(subPath => !subPath.isCollapsing())
      .map((subPath, subIdx) => {
        return this.findSubPathState(this.toSpsIdx(subIdx)).commandStates;
      })
      .forEachRight((css, spsIdx) => {
        const firstCmd = css[0].getCommands()[0];
        const lastCmd = _.last(_.last(css).getCommands());
        const isClosed = firstCmd.getEnd().equals(lastCmd.getEnd());
        if (!isClosed) {
          // If this happens, the SVG is probably not going to render properly at all,
          // but we'll check anyway just to be safe.
          return true;
        }
        const bounds = createBoundingBox(...css);
        if (!bounds.contains(point)) {
          // Nothing to see here. Check the next subpath.
          return true;
        }
        // The point is inside the subpath's bounding box, so next, we will
        // use the 'even-odd rule' to determine if the filled path has been hit.
        // We create a line from the mouse point to a point we know that is not
        // inside the path (in this case, we use a coordinate outside the path's
        // bounded box). A hit has occured if and only if the number of
        // intersections between the line and the path is odd.
        const line = { p1: point, p2: new Point(bounds.r + 1, bounds.b + 1) };
        // Filter out t=0 values since they will be accounted for by
        // neighboring t=1 values.
        const intersectionResults = css.map(cm => cm.intersects(line).filter(t => !!t));
        const numIntersections = _.sum(intersectionResults.map(ts => ts.length));
        if (numIntersections % 2 !== 0) {
          hitSpsIdx = spsIdx;
        }
        return hitSpsIdx === undefined;
      })
      .value();

    if (hitSpsIdx === undefined) {
      return { isHit: false };
    }

    const hitSubIdx = this.subPathOrdering[hitSpsIdx];
    return {
      isHit: true,
      subIdx: hitSubIdx,
    };
  }

  // TODO: move this math stuff into the calculators module
  // TODO: approximate bezier curves by splitting them up into line segments
  // TODO: write tests for this stuff
  getPoleOfInaccessibility(subIdx: number) {
    const cmds = this.subPaths[subIdx].getCommands().slice(1);
    const polygon = _.flatMap(cmds, cmd => {
      const { x: p1x, y: p1y } = cmd.getStart();
      const { x: p2x, y: p2y } = cmd.getEnd();
      return [[p1x, p1y], [p2x, p2y]];
    });
    if (cmds.length && !this.subPaths[subIdx].isClosed()) {
      const { x: p1x, y: p1y } = cmds[0].getStart();
      const { x: p2x, y: p2y } = _.last(cmds).getEnd();
      polygon.push(...[[p1x, p1y], [p2x, p2y]]);
    }
    const pole = polylabel([polygon]);
    return new Point(pole[0], pole[1]);
  }

  private toSpsIdx(subIdx: number) {
    return this.subPathOrdering[subIdx];
  }

  private toSubIdx(spsIdx: number) {
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (this.subPathOrdering[i] === spsIdx) {
        return i;
      }
    }
    throw new Error('Invalid spsIdx: ' + spsIdx);
  }

  private toCmdIdx(spsIdx: number, csIdx: number, splitIdx: number) {
    const sps = this.findSubPathState(spsIdx);
    const commandStates = sps.commandStates;
    const numCmds =
      _.chain(commandStates)
        .map((cs: CommandState, i) => cs.getCommands().length)
        .sum()
        .value();
    let cmdIdx = splitIdx
      + _.chain(commandStates)
        .map((cs: CommandState, i) => i < csIdx ? cs.getCommands().length : 0)
        .sum()
        .value();
    let shiftOffset = sps.shiftOffset;
    if (sps.isReversed) {
      cmdIdx = numCmds - cmdIdx;
      shiftOffset *= -1;
      shiftOffset += numCmds - 1;
    }
    if (shiftOffset) {
      cmdIdx += numCmds - shiftOffset - 1;
      if (cmdIdx >= numCmds) {
        cmdIdx = cmdIdx - numCmds + 1;
      }
    }
    return cmdIdx;
  }
}

// TODO: cache this?
function createBoundingBox(...css: CommandState[]) {
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

  const expandBoundsFn = (x: number, y: number) => {
    if (isNaN(x) || isNaN(y)) {
      return;
    }
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsForCommandMutationFn = (cs: CommandState) => {
    const bbox = cs.getBoundingBox();
    expandBoundsFn(bbox.x.min, bbox.y.min);
    expandBoundsFn(bbox.x.max, bbox.y.min);
    expandBoundsFn(bbox.x.min, bbox.y.max);
    expandBoundsFn(bbox.x.max, bbox.y.max);
  };

  css.forEach(cs => expandBoundsForCommandMutationFn(cs));
  return bounds;
}
