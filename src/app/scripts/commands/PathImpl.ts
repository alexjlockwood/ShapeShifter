import * as _ from 'lodash';
import { MathUtil, Point, Matrix, Rect } from '../common';
import {
  Path, SubPath, Command, SvgChar, ProjectionResult, HitResult, HitOptions
} from '.';
import * as PathParser from './PathParser';
import { newSubPath } from './SubPathImpl';
import { CommandImpl, newMove, newLine } from './CommandImpl';
import { CommandMutation } from './CommandMutation';

export function newPath(obj: string | Command[]): Path {
  return new PathImpl(obj);
}

/**
 * Implementation of the Path interface. Represents all of the information
 * associated with a path layer's pathData attribute. Also provides mechanisms for
 * splitting/unsplitting/converting/etc. paths in a way that is easily reversible.
 */
class PathImpl implements Path {
  private readonly subPaths: ReadonlyArray<SubPath>;
  private readonly pathMutation: PathMutation;
  private pathString: string;
  private pathLength: number;

  constructor(obj: string | Command[] | { subPaths: SubPath[], pathMutation: PathMutation }) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      this.subPaths =
        createSubPaths(...(typeof obj === 'string' ? PathParser.parseCommands(obj) : obj));
      this.pathMutation = new PathMutation(this.subPaths);
    } else {
      this.subPaths = obj.subPaths;
      this.pathMutation = obj.pathMutation;
    }
  }

  get commandMutationsMap() {
    return this.pathMutation.commandMutationsMap;
  }

  get reversals() {
    return this.pathMutation.reversals;
  }

  get shiftOffsets() {
    return this.pathMutation.shiftOffsets;
  }

  get subPathOrdering() {
    return this.pathMutation.subPathOrdering;
  }

  // Implements the Path interface.
  clone(ms: MutationState = {}) {
    // TODO: this method could probably be more efficient.
    const commandMutationsMap = ms.commandMutationsMap || this.commandMutationsMap;
    const reversals = ms.reversals || this.reversals;
    const shiftOffsets = ms.shiftOffsets || this.shiftOffsets;
    const subPathOrdering = ms.subPathOrdering || this.subPathOrdering;

    const maybeReverseCommandsFn = (cmsIdx: number) => {
      const subPathCms = commandMutationsMap[cmsIdx];
      const hasOneCmd =
        subPathCms.length === 1 && subPathCms[0].getCommands().length === 1;
      if (hasOneCmd || !reversals[cmsIdx]) {
        // Nothing to do in these two cases.
        return _.flatMap(subPathCms, cm => cm.getCommands() as CommandImpl[]);
      }

      // Extract the commands from our command mutation map.
      const cmds = _.flatMap(subPathCms, cm => {
        // Consider a segment A ---- B ---- C with AB split and
        // BC non-split. When reversed, we want the user to see
        // C ---- B ---- A w/ CB split and BA non-split.
        const cmCmds = cm.getCommands().slice();
        if (cmCmds[0].svgChar === 'M') {
          return cmCmds;
        }
        cmCmds[0] = cmCmds[0].toggleSplit();
        cmCmds[cmCmds.length - 1] = cmCmds[cmCmds.length - 1].toggleSplit();
        return cmCmds;
      });

      // If the last command is a 'Z', replace it with a line before we reverse.
      const lastCmd = _.last(cmds);
      if (lastCmd.svgChar === 'Z') {
        const lineCmd = newLine(lastCmd.start, lastCmd.end);
        cmds[cmds.length - 1] = lastCmd.isSplit ? lineCmd.toggleSplit() : lineCmd;
      }

      // Reverse the commands.
      const newCmds = [];
      for (let i = cmds.length - 1; i > 0; i--) {
        newCmds.push(cmds[i].reverse());
      }
      newCmds.unshift(newMove(cmds[0].start, newCmds[0].start));
      return newCmds;
    };

    const maybeShiftCommandsFn = (cmsIdx: number, cmds: Command[]) => {
      let shiftOffset = shiftOffsets[cmsIdx];
      if (!shiftOffset
        || cmds.length === 1
        || !_.first(cmds).end.equals(_.last(cmds).end)) {
        // If there is no shift offset, the sub path is one command long,
        // or if the sub path is not closed, then do nothing.
        return cmds;
      }

      const numCommands = cmds.length;
      if (reversals[cmsIdx]) {
        shiftOffset *= -1;
        shiftOffset += numCommands - 1;
      }

      // If the last command is a 'Z', replace it with a line before we shift.
      const lastCmd = _.last(cmds);
      if (lastCmd.svgChar === 'Z') {
        // TODO: replacing the 'Z' messes up certain stroke-linejoin values
        const lineCmd = newLine(lastCmd.start, lastCmd.end);
        cmds[numCommands - 1] = lastCmd.isSplit ? lineCmd.toggleSplit() : lineCmd;
      }

      const newCmds: Command[] = [];

      // Handle these case separately cause they are annoying and I'm sick of edge cases.
      if (shiftOffset === 1) {
        newCmds.push(newMove(cmds[0].start, cmds[1].end));
        for (let i = 2; i < cmds.length; i++) {
          newCmds.push(cmds[i]);
        }
        newCmds.push(cmds[1]);
        return newCmds;
      } else if (shiftOffset === numCommands - 1) {
        newCmds.push(newMove(cmds[0].start, cmds[numCommands - 2].end));
        newCmds.push(_.last(cmds));
        for (let i = 1; i < cmds.length - 1; i++) {
          newCmds.push(cmds[i]);
        }
        return newCmds;
      }

      // Shift the sequence of commands. After the shift, the original move
      // command will be at index 'numCommands - shiftOffset'.
      for (let i = 0; i < numCommands; i++) {
        newCmds.push(cmds[(i + shiftOffset) % numCommands]);
      }

      // The first start point will either be undefined,
      // or the end point of the previous sub path.
      const prevMoveCmd = newCmds.splice(numCommands - shiftOffset, 1)[0];
      newCmds.push(newCmds.shift());
      newCmds.unshift(newMove(prevMoveCmd.start, _.last(newCmds).end));
      return newCmds;
    };

    const subPathCmds = commandMutationsMap.map((_, cmsIdx) => {
      return maybeShiftCommandsFn(cmsIdx, maybeReverseCommandsFn(cmsIdx));
    });
    const reorderedSubPathCmds = [];
    for (let i = 0; i < subPathCmds.length; i++) {
      for (let j = 0; j < subPathOrdering.length; j++) {
        const reorderIdx = subPathOrdering[j];
        if (i === reorderIdx) {
          reorderedSubPathCmds.push(subPathCmds[j]);
          break;
        }
      }
    }
    const reorderedCommands = _.flatMap(reorderedSubPathCmds, cmds => cmds);
    reorderedCommands.forEach((cmd, i) => {
      if (cmd.svgChar === 'M') {
        if (i === 0 && cmd.start) {
          reorderedCommands[i] = newMove(undefined, cmd.end);
        } else if (i !== 0 && !cmd.start) {
          reorderedCommands[i] = newMove(reorderedCommands[i - 1].end, cmd.end);
        }
      }
    });
    return new PathImpl({
      subPaths: createSubPaths(...reorderedCommands),
      pathMutation: new PathMutation({
        commandMutationsMap,
        reversals,
        shiftOffsets,
        subPathOrdering,
      }),
    });
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
    return this.subPaths;
  }

  // Implements the Path interface.
  getCommands(): ReadonlyArray<Command> {
    return _.flatMap(this.subPaths, subPath => subPath.getCommands() as Command[]);
  }

  // Implements the Path interface.
  getPathLength() {
    if (this.pathLength === undefined) {
      // Note that we only return the length of the first sub path due to
      // https://code.google.com/p/android/issues/detail?id=172547
      this.pathLength = _.sum(this.commandMutationsMap[0].map(cm => cm.getPathLength()));
    }
    return this.pathLength;
  }

  // Implements the Path interface.
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return cmds1.length === cmds2.length
      && cmds1.every((cmd1, i) => cmd1.svgChar === cmds2[i].svgChar);
  }

  // Implements the Path interface.
  interpolate(start: Path, end: Path, fraction: number): Path {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }
    // TODO: is this overkill? might be smart to make this more memory efficient.
    return new PathImpl(
      _.zipWith<Command>(
        start.getCommands(),
        this.getCommands(),
        end.getCommands(),
        (startCmd: Command, currCmd: Command, endCmd: Command) => {
          return new CommandImpl(
            currCmd.svgChar,
            _.zipWith<Point>(
              startCmd.points,
              currCmd.points,
              endCmd.points,
              (startPt: Point, currPt: Point, endPt: Point) => {
                if (!startPt || !currPt || !endPt) {
                  // The 'start' point of the first Move command in a path
                  // will be undefined. Skip it.
                  return undefined;
                }
                return new Point(
                  MathUtil.lerp(startPt.x, endPt.x, fraction),
                  MathUtil.lerp(startPt.y, endPt.y, fraction));
              }),
            currCmd.isSplit);
        }));
  }

  // Implements the Path interface.
  project(point: Point): { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {
    const minProjectionResultInfo =
      _.chain(this.commandMutationsMap as CommandMutation[][])
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

  // Implements the Path interface.
  reverse(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    return this.clone({
      reversals: this.reversals.map((r, i) => i === cmsIdx ? !r : r),
    });
  }

  // Implements the Path interface.
  shiftBack(subIdx: number, numShifts = 1) {
    return this.pathMutation.isReversedAt(subIdx)
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  // Implements the Path interface.
  shiftForward(subIdx: number, numShifts = 1) {
    return this.pathMutation.isReversedAt(subIdx)
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  private shift(
    subIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    const numCommands = this.subPaths[subIdx].getCommands().length;
    if (numCommands <= 1 || !this.subPaths[subIdx].isClosed()) {
      return this;
    }
    const cmsIdx = this.subPathOrdering[subIdx];
    return this.clone({
      shiftOffsets: this.shiftOffsets.map((offset, i) => {
        return i === cmsIdx ? calcOffsetFn(offset, numCommands) : offset;
      }),
    });
  }

  // Implements the Path interface.
  getId(subIdx: number, cmdIdx: number) {
    const { targetCm, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    return targetCm.getIdAtIndex(splitIdx);
  }

  // Implements the Path interface.
  split(subIdx: number, cmdIdx: number, ...ts: number[]) {
    if (!ts.length) {
      console.warn('Attempt to split a path with an empty spread argument');
      return this;
    }
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    const commandMutationsMap =
      this.replaceCommandMutation(cmsIdx, cmIdx, targetCm.splitAtIndex(splitIdx, ts));
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // Implements the Path interface.
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    // TODO: should  we need to sort by subIdx or cmsIdx here?
    ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index split operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: Path = this;
    for (const { subIdx, cmdIdx, ts } of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.split(subIdx, cmdIdx, ...ts);
    }
    return result;
  }

  // Implements the Path interface.
  splitInHalf(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, 1);
    const commandMutationsMap =
      this.replaceCommandMutation(cmsIdx, cmIdx, targetCm.splitInHalfAtIndex(splitIdx));
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // If 0 <= cmIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(cmsIdx: number, cmIdx: number, numSplits: number) {
    const shiftOffsets = this.shiftOffsets.slice();
    const shiftOffset = shiftOffsets[cmsIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      shiftOffsets[cmsIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the Path interface.
  unsplit(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const isSubPathReversed = this.pathMutation.isReversedAt(subIdx);
    const commandMutationsMap =
      this.replaceCommandMutation(
        cmsIdx,
        cmIdx,
        targetCm.unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx));
    const shiftOffset = this.pathMutation.getShiftOffsetAt[subIdx];
    let shiftOffsets = undefined;
    if (shiftOffset && cmIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      shiftOffsets = this.shiftOffsets.slice();
      shiftOffsets[cmsIdx] = shiftOffset - 1;
    }
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // Implements the Path interface.
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    // TODO: should  we need to sort by subIdx or cmsIdx here?
    ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index unsplits first so that we don't alter the
      // indices of the lower index unsplit operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: Path = this;
    for (const { subIdx, cmdIdx } of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.unsplit(subIdx, cmdIdx);
    }
    return result;
  }

  // Implements the Path interface.
  convert(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const commandMutationsMap =
      this.replaceCommandMutation(
        cmsIdx, cmIdx, targetCm.convertAtIndex(splitIdx, svgChar));
    return this.clone({ commandMutationsMap });
  }

  // Implements the Path interface.
  unconvertSubPath(subIdx: number) {
    const commandMutationsMap = this.commandMutationsMap.map(cms => cms.slice());
    const cmsIdx = this.subPathOrdering[subIdx];
    commandMutationsMap[cmsIdx] =
      commandMutationsMap[cmsIdx].map((cm, i) => i === 0 ? cm : cm.unconvertSubpath());
    return this.clone({ commandMutationsMap });
  }

  // Implements the Path interface.
  revert() {
    return this.clone({
      commandMutationsMap: this.commandMutationsMap.map(cms => cms.map(cm => cm.revert())),
      shiftOffsets: this.shiftOffsets.map(_ => 0),
      reversals: this.reversals.map(_ => false),
      subPathOrdering: this.subPathOrdering.map((_, i) => i),
    });
  }

  // Implements the Path interface.
  transform(transforms: Matrix[]) {
    const commandMutationsMap =
      this.commandMutationsMap.map(cms => cms.map(cm => cm.transform(transforms)));
    return this.clone({ commandMutationsMap });
  }

  /**
   * Finds and returns the command mutation at the specified indices.
   * @param subIdx the client-visible subpath index
   * @param cmdIdx the client-visible command index
   */
  private findCommandMutation(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const subPathCms = this.pathMutation.getCommandMutationsAt(subIdx);
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
    if (cmdIdx && this.pathMutation.isReversedAt(subIdx)) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += this.pathMutation.getShiftOffsetAt(subIdx);
    if (cmdIdx >= numCommandsInSubPath) {
      cmdIdx -= (numCommandsInSubPath - 1);
    }
    let counter = 0;
    let cmIdx = 0;
    for (const targetCm of subPathCms) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        const splitIdx = cmdIdx - counter;
        return { targetCm, cmsIdx, cmIdx, splitIdx };
      }
      counter += targetCm.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }

  private replaceCommandMutation(cmsIdx: number, cmIdx: number, cm: CommandMutation) {
    const newCms = this.commandMutationsMap.map(cms => cms.slice());
    newCms[cmsIdx][cmIdx] = cm;
    return newCms;
  }

  hitTest(point: Point, opts: HitOptions) {
    // First search for in-range path points.
    const pointResult =
      _.chain(this.subPaths as SubPath[])
        .map((subPath, subIdx) => {
          return subPath.getCommands()
            .map((cmd, cmdIdx) => {
              const distance = MathUtil.distance(cmd.end, point);
              const isSplit = cmd.isSplit;
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
    } else if (opts.hitTestPointsOnly) {
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
          cms[0].getCommands()[0].end.equals((_.last(_.last(cms).getCommands())).end);
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
        const numIntersections = _.sum(cms.map(cm => cm.intersects(line).length));
        if (numIntersections % 2 !== 0) {
          hitCmsIdx = cmsIdx;
        }
        return hitCmsIdx === undefined;
      });

    if (hitCmsIdx === undefined) {
      return { isHit: false };
    }

    const hitSubIdx = this.subPathOrdering[hitCmsIdx];
    return {
      isHit: true,
      subIdx: hitSubIdx,
    };
  }

  moveSubPath(fromSubIdx: number, toSubIdx: number) {
    const subPathOrdering = this.subPathOrdering.slice();
    subPathOrdering.splice(toSubIdx, 0, subPathOrdering.splice(fromSubIdx, 1)[0]);
    return this.clone({ subPathOrdering });
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
    return splitIdx + _.chain(this.commandMutationsMap[cmsIdx])
      .map((cm, i) => i < cmIdx ? cm.getCommands().length : 0)
      .sum()
      .value();
  }
}

// TODO: cache this?
function createBoundingBox(...cms: CommandMutation[]) {
  const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

  const expandBoundsFn = (x: number, y: number) => {
    bounds.l = Math.min(x, bounds.l);
    bounds.t = Math.min(y, bounds.t);
    bounds.r = Math.max(x, bounds.r);
    bounds.b = Math.max(y, bounds.b);
  };

  const expandBoundsForCommandMutationFn = (cm: CommandMutation) => {
    const bbox = cm.getBoundingBox();
    expandBoundsFn(bbox.x.min, bbox.y.min);
    expandBoundsFn(bbox.x.max, bbox.y.min);
    expandBoundsFn(bbox.x.min, bbox.y.max);
    expandBoundsFn(bbox.x.max, bbox.y.max);
  };

  cms.forEach(cm => expandBoundsForCommandMutationFn(cm));
  return bounds;
}

function createSubPaths(...commands: Command[]) {
  if (!commands.length || commands[0].svgChar !== 'M') {
    // TODO: is this case actually possible? should we insert 'M 0 0' instead?
    return [];
  }
  let lastSeenMove: Command;
  let currentCmdList: Command[] = [];
  const subPathCmds: SubPath[] = [];
  for (const cmd of commands) {
    if (cmd.svgChar === 'M') {
      lastSeenMove = cmd;
      if (currentCmdList.length) {
        subPathCmds.push(newSubPath(currentCmdList));
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
    if (cmd.svgChar === 'Z') {
      subPathCmds.push(newSubPath(currentCmdList));
      currentCmdList = [];
    }
  }
  if (currentCmdList.length) {
    subPathCmds.push(newSubPath(currentCmdList));
  }
  return subPathCmds;
}

interface MutationState {
  readonly commandMutationsMap?: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  // Maps internal cmsIdx values to the subpath's current reversal state.
  readonly reversals?: ReadonlyArray<boolean>;
  // Maps internal cmsIdx values to the subpath's current shift offset state.
  readonly shiftOffsets?: ReadonlyArray<number>;
  // Maps client-visible subIdx values to internal cmsIdx values.
  readonly subPathOrdering?: ReadonlyArray<number>;
}

class PathMutation {
  readonly commandMutationsMap: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  readonly reversals: ReadonlyArray<boolean>;
  readonly shiftOffsets: ReadonlyArray<number>;
  readonly subPathOrdering: ReadonlyArray<number>;

  constructor(obj: ReadonlyArray<SubPath> | MutationState) {
    if (Array.isArray(obj)) {
      const subPaths = obj as ReadonlyArray<SubPath>;
      this.commandMutationsMap =
        subPaths.map(s => s.getCommands().map(c => new CommandMutation(c as CommandImpl)));
      this.shiftOffsets = subPaths.map(_ => 0);
      this.reversals = subPaths.map(_ => false);
      this.subPathOrdering = subPaths.map((_, i) => i);
    } else {
      const ms = obj as MutationState;
      this.commandMutationsMap = ms.commandMutationsMap.map(cms => cms.slice());
      this.reversals = ms.reversals.slice();
      this.shiftOffsets = ms.shiftOffsets.slice();
      this.subPathOrdering = ms.subPathOrdering.slice();
    }
  }

  getCommandMutationsAt(subIdx: number) {
    return this.commandMutationsMap[this.subPathOrdering[subIdx]];
  }

  getShiftOffsetAt(subIdx: number) {
    return this.shiftOffsets[this.subPathOrdering[subIdx]];
  }

  isReversedAt(subIdx: number) {
    return this.reversals[this.subPathOrdering[subIdx]];
  }
}
