import * as _ from 'lodash';
import { SubPath, Command, ProjectionResult, HitOptions } from '.';
import { createSubPaths } from './SubPathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Point, Rect } from '../common';
import * as PathParser from './PathParser';
import * as polylabel from 'polylabel';
import { SubPathState } from './SubPathState';

export class PathState {
  readonly subPaths: ReadonlyArray<SubPath>;
  readonly commands: ReadonlyArray<Command>;

  constructor(
    private readonly obj: string | Command[],
    // Maps internal cmsIdx values to each subpath's current state.
    public readonly subPathStates?: ReadonlyArray<SubPathState>,
    // Maps internal cmsIdx values to the subpath's current reversal state.
    public readonly reversals?: ReadonlyArray<boolean>,
    // Maps internal cmsIdx values to the subpath's current shift offset state.
    // Note that a shift offset value of 'x' means 'perform x number of shift back ops'.
    public readonly shiftOffsets?: ReadonlyArray<number>,
    // Maps internal cmsIdx values to internal subpath IDs.
    public readonly subPathIds?: ReadonlyArray<string>,
    // Maps client-visible subIdx values to internal cmsIdx values.
    public readonly subPathOrdering?: ReadonlyArray<number>,
    // The number of collapsing subpaths appended to the end of the command mutation map.
    public readonly numCollapsingSubPaths = 0,
  ) {
    const commands = (typeof obj === 'string' ? PathParser.parseCommands(obj) : obj);
    const subPaths = createSubPaths(commands);
    this.subPathStates =
      subPathStates
        ? subPathStates.map(sps => sps.clone())
        : subPaths.map(s => new SubPathState(s.getCommands().map(c => new CommandState(c))));
    this.reversals =
      reversals ? reversals.slice() : subPaths.map(_ => false);
    this.shiftOffsets =
      shiftOffsets ? shiftOffsets.slice() : subPaths.map(_ => 0);
    this.subPathIds =
      subPathIds ? subPathIds.slice() : subPaths.map(s => _.uniqueId());
    this.subPathOrdering =
      subPathOrdering ? subPathOrdering.slice() : subPaths.map((_, i) => i);
    this.subPaths = subPaths.map((subPath, subIdx) => {
      const cmds = subPath.getCommands().map((cmd, cmdIdx) => {
        return cmd.mutate()
          .setId(this.findCommandStateId(subIdx, cmdIdx, subPaths))
          .build();
      });
      const cmsIdx = this.subPathOrdering[subIdx];
      const isCollapsing =
        this.subPathStates.length - this.numCollapsingSubPaths <= cmsIdx;
      return subPath.mutate()
        .setId(this.subPathIds[cmsIdx])
        .setCommands(cmds)
        .setIsCollapsing(isCollapsing)
        .setIsReversed(this.reversals[cmsIdx])
        .setShiftOffset(this.shiftOffsets[cmsIdx])
        .build();
    });
    this.commands = _.flatMap(this.subPaths, subPath => subPath.getCommands() as Command[]);
  }

  private findCommandStateId(subIdx: number, cmdIdx: number, subPaths?: SubPath[]) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const sps = this.subPathStates[cmsIdx];
    const numCommandsInSubPath =
      _.sum(sps.commandStates.map(cm => cm.getCommands().length));
    if (cmdIdx && this.reversals[cmsIdx]) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += this.shiftOffsets[cmsIdx];
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting numCommandsInSubPath is intentional here
      // (as opposed to subtracting numCommandsInSubPath - 1).
      cmdIdx -= numCommandsInSubPath;
    }
    let counter = 0;
    for (const targetCm of sps.commandStates) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        const splitIdx = cmdIdx - counter;
        return targetCm.getIdAtIndex(splitIdx);
      }
      counter += targetCm.getCommands().length;
    }
    throw new Error('Error retrieving command mutation');
  }

  getPathLength() {
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    const sps = this.subPathStates[0];
    return _.sum(sps.commandStates.map(cm => cm.getPathLength()));
  }

  project(point: Point):
    { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {

    const minProjectionResultInfo =
      _.chain(this.subPaths as SubPath[])
        .filter(subPath => !subPath.isCollapsing())
        .map((subPath, subIdx) => {
          const cmsIdx = this.subPathOrdering[subIdx];
          return this.subPathStates[cmsIdx].commandStates
            .map((cm, cmIdx) => {
              const projection = cm.project(point);
              return {
                cmsIdx,
                cmIdx,
                splitIdx: projection ? projection.splitIdx : 0,
                projection: projection ? projection.projectionResult : undefined,
              };
            });
        })
        .flatMap(projections => projections)
        .filter(obj => !!obj.projection)
        .reduce((prev, curr) => {
          return prev && prev.projection.d < curr.projection.d ? prev : curr;
        }, undefined)
        .value();
    if (!minProjectionResultInfo) {
      return undefined;
    }
    const cmsIdx = minProjectionResultInfo.cmsIdx;
    const cmIdx = minProjectionResultInfo.cmIdx;
    const splitIdx = minProjectionResultInfo.splitIdx;
    const projection = minProjectionResultInfo.projection;
    const subIdx = this.toSubIdx(cmsIdx);
    const cmdIdx = this.toCmdIdx(cmsIdx, cmIdx, splitIdx);
    return { projection, subIdx, cmdIdx };
  }

  hitTest(point: Point, opts: HitOptions) {
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

    let hitCmsIdx: number = undefined;

    // Search from right to left so that higher z-order subpaths are found first.
    _.chain(this.subPaths as SubPath[])
      .filter(subPath => !subPath.isCollapsing())
      .map((subPath, subIdx) => {
        return this.subPathStates[this.toCmsIdx(subIdx)].commandStates;
      })
      .forEachRight((cms, cmsIdx) => {
        const firstCmd = cms[0].getCommands()[0];
        const lastCmd = _.last(_.last(cms).getCommands());
        const isClosed = firstCmd.getEnd().equals(lastCmd.getEnd());
        if (!isClosed) {
          // If this happens, the SVG is probably not going to render properly at all,
          // but we'll check anyway just to be safe.
          return true;
        }
        const bounds = createBoundingBox(...cms);
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
        const intersectionResults = cms.map(cm => cm.intersects(line).filter(t => !!t));
        const numIntersections = _.sum(intersectionResults.map(ts => ts.length));
        if (numIntersections % 2 !== 0) {
          hitCmsIdx = cmsIdx;
        }
        return hitCmsIdx === undefined;
      })
      .value();

    if (hitCmsIdx === undefined) {
      return { isHit: false };
    }

    const hitSubIdx = this.subPathOrdering[hitCmsIdx];
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
      if (p1x === p2x && p1y === p2y) {
        return [];
      }
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

  private toCmsIdx(subIdx: number) {
    return this.subPathOrdering[subIdx];
  }

  private toSubIdx(cmsIdx: number) {
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (this.subPathOrdering[i] === cmsIdx) {
        return i;
      }
    }
    throw new Error('Invalid cmsIdx: ' + cmsIdx);
  }

  private toCmdIdx(cmsIdx: number, cmIdx: number, splitIdx: number) {
    const commandStates = this.subPathStates[cmsIdx].commandStates;
    const numCmds =
      _.chain(commandStates)
        .map((cm: CommandState, i) => cm.getCommands().length)
        .sum()
        .value();
    let cmdIdx = splitIdx
      + _.chain(commandStates)
        .map((cm: CommandState, i) => i < cmIdx ? cm.getCommands().length : 0)
        .sum()
        .value();
    let shiftOffset = this.shiftOffsets[cmsIdx];
    if (this.reversals[cmsIdx]) {
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
function createBoundingBox(...cms: CommandState[]) {
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

  const expandBoundsForCommandMutationFn = (cm: CommandState) => {
    const bbox = cm.getBoundingBox();
    expandBoundsFn(bbox.x.min, bbox.y.min);
    expandBoundsFn(bbox.x.max, bbox.y.min);
    expandBoundsFn(bbox.x.min, bbox.y.max);
    expandBoundsFn(bbox.x.max, bbox.y.max);
  };

  cms.forEach(cm => expandBoundsForCommandMutationFn(cm));
  return bounds;
}
