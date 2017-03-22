import * as _ from 'lodash';
import { SubPath, Command, ProjectionResult, HitOptions } from '.';
import { newSubPath } from './SubPathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Point, Rect } from '../common';
import * as PathParser from './PathParser';

export class PathState {
  readonly subPaths: ReadonlyArray<SubPath>;
  readonly commands: ReadonlyArray<Command>;

  constructor(
    private readonly obj: string | Command[],
    // Maps internal cmsIdx values to the subpath's current reversal state.
    public readonly commandMutationsMap?: ReadonlyArray<ReadonlyArray<CommandState>>,
    // Maps internal cmsIdx values to the subpath's current reversal state.
    public readonly reversals?: ReadonlyArray<boolean>,
    // Maps internal cmsIdx values to the subpath's current shift offset state.
    // Note that a shift offset value of 'x' means 'perform x number of shift back ops'.
    public readonly shiftOffsets?: ReadonlyArray<number>,
    // Maps internal cmsIdx values to internal subpath IDs.
    public readonly subPathIds?: ReadonlyArray<string>,
    // Maps client-visible subIdx values to internal cmsIdx values.
    public readonly subPathOrdering?: ReadonlyArray<number>,
  ) {
    // TODO: avoid constructing the subpaths twice
    const commands = (typeof obj === 'string' ? PathParser.parseCommands(obj) : obj);
    const subPaths = createSubPaths(commands);
    this.commandMutationsMap =
      commandMutationsMap
        ? commandMutationsMap.map(cms => cms.slice())
        : subPaths.map(s => s.getCommands().map(c => new CommandState(c)));
    this.reversals =
      reversals ? reversals.slice() : subPaths.map(_ => false);
    this.shiftOffsets =
      shiftOffsets ? shiftOffsets.slice() : subPaths.map(_ => 0);
    this.subPathIds =
      subPathIds ? subPathIds.slice() : subPaths.map(s => _.uniqueId());
    this.subPathOrdering =
      subPathOrdering ? subPathOrdering.slice() : subPaths.map((_, i) => i);
    this.commands = _.flatMap(subPaths, (subPath, subIdx) => {
      return subPath.getCommands().map((cmd, cmdIdx) => {
        return cmd.mutate().setId(this.findCommandStateId(subIdx, cmdIdx)).build();
      });
    });
    this.subPaths =
      createSubPaths(
        this.commands,
        this.subPathIds.map((_, i) => this.subPathIds[this.subPathOrdering[i]]));
  }

  private findCommandStateId(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const subPathCms = this.commandMutationsMap[cmsIdx];
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
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
    for (const targetCm of subPathCms) {
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
    return _.sum(this.commandMutationsMap[0].map(cm => cm.getPathLength()));
  }

  project(point: Point):
    { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {

    const minProjectionResultInfo =
      _.chain(this.commandMutationsMap as CommandState[][])
        .map((subPathCms, cmsIdx) =>
          subPathCms.map((cm, cmIdx) => {
            const projection = cm.project(point);
            return {
              cmsIdx,
              cmIdx,
              splitIdx: projection ? projection.splitIdx : 0,
              projection: projection ? projection.projectionResult : undefined,
            };
          }))
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
      // If the shortest distance from the point to the path is less than half
      // the stroke width, then select the path.

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
      .map((subPath, subIdx) => this.commandMutationsMap[this.toCmsIdx(subIdx)])
      .forEachRight((cms, cmsIdx) => {
        const isClosed =
          cms[0].getCommands()[0].getEnd().equals((_.last(_.last(cms).getCommands())).getEnd());
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
    const numCmds = _.chain(this.commandMutationsMap[cmsIdx] as CommandState[])
      .map((cm, i) => cm.getCommands().length)
      .sum()
      .value();
    let cmdIdx = splitIdx + _.chain(this.commandMutationsMap[cmsIdx] as CommandState[])
      .map((cm, i) => i < cmIdx ? cm.getCommands().length : 0)
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

function createSubPaths(commands: ReadonlyArray<Command>, subPathIds: string[] = []) {
  if (!commands.length || commands[0].getSvgChar() !== 'M') {
    // TODO: is this case actually possible? should we insert 'M 0 0' instead?
    return [];
  }

  let currentCmdList: Command[] = [];
  const getNextSubPathFn = () => {
    return newSubPath(subPathIds.length ? subPathIds.shift() : '', currentCmdList);
  };

  let lastSeenMove: Command;
  const subPathCmds: SubPath[] = [];
  for (const cmd of commands) {
    if (cmd.getSvgChar() === 'M') {
      lastSeenMove = cmd;
      if (currentCmdList.length) {
        subPathCmds.push(getNextSubPathFn());
        currentCmdList = [];
      } else {
        currentCmdList.push(cmd);
      }
      continue;
    }
    if (!currentCmdList.length) {
      currentCmdList.push(lastSeenMove);
    }
    currentCmdList.push(cmd);
    if (cmd.getSvgChar() === 'Z') {
      subPathCmds.push(getNextSubPathFn());
      currentCmdList = [];
    }
  }
  if (currentCmdList.length) {
    subPathCmds.push(getNextSubPathFn());
  }
  return subPathCmds;
}
