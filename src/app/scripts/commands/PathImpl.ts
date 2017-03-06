import * as _ from 'lodash';
import { MathUtil, Point } from '../common';
import { Path, SubPath, Command, SvgChar, Projection } from '.';
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
  private readonly commandMutationsMap: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  private readonly shiftOffsets: ReadonlyArray<number>;
  private readonly reversals: ReadonlyArray<boolean>;
  private pathString: string;
  private pathLength: number;

  constructor(obj: string | Command[] | PathParams) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      if (typeof obj === 'string') {
        this.pathString = obj;
        this.subPaths = createSubPaths(...PathParser.parseCommands(obj));
      } else {
        this.subPaths = createSubPaths(...obj);
      }
      this.commandMutationsMap =
        this.subPaths.map(s => s.getCommands().map(c => new CommandMutation(c as CommandImpl)));
      this.shiftOffsets = this.subPaths.map(_ => 0);
      this.reversals = this.subPaths.map(_ => false);
    } else {
      this.subPaths = createSubPaths(...obj.commands);
      this.commandMutationsMap = obj.commandMutationsMap.map(cms => cms.slice());
      this.shiftOffsets = obj.shiftOffsets.slice();
      this.reversals = obj.reversals.slice();
    }
  }

  // Implements the Path interface.
  clone(params: PathParams = {}) {
    // TODO: only recompute the stuff that we know has changed...
    const newCommandMutationsMap =
      params.commandMutationsMap
        ? params.commandMutationsMap
        : this.commandMutationsMap;

    const shouldReverseFn = (subIdx: number) =>
      params.reversals
        ? params.reversals[subIdx]
        : this.reversals[subIdx];

    const getShiftOffsetFn = (subIdx: number) =>
      params.shiftOffsets
        ? params.shiftOffsets[subIdx]
        : this.shiftOffsets[subIdx];

    const maybeReverseCommandsFn = (subIdx: number) => {
      const subPathCms = newCommandMutationsMap[subIdx];
      const hasOneCmd =
        subPathCms.length === 1 && _.first(subPathCms).getCommands().length === 1;
      if (hasOneCmd || !shouldReverseFn(subIdx)) {
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
        cmCmds[0] = _.first(cmCmds).toggleSplit();
        cmCmds[cmCmds.length - 1] = _.last(cmCmds).toggleSplit();
        return cmCmds;
      });

      // If the last command is a 'Z', replace it with a line before we reverse.
      const lastCmd = _.last(cmds);
      if (lastCmd.svgChar === 'Z') {
        cmds[cmds.length - 1] = newLine(lastCmd.start, lastCmd.end, lastCmd.isSplit);
      }

      // Reverse the commands.
      const newCmds = [];
      for (let i = cmds.length - 1; i > 0; i--) {
        newCmds.push(cmds[i].reverse());
      }
      newCmds.unshift(newMove(_.first(cmds).start, _.first(newCmds).start));
      return newCmds;
    };

    const maybeShiftCommandsFn = (subIdx: number, cmds: Command[]) => {
      let shiftOffset = getShiftOffsetFn(subIdx);
      if (!shiftOffset
        || cmds.length === 1
        || !_.first(cmds).end.equals(_.last(cmds).end)) {
        // If there is no shift offset, the sub path is one command long,
        // or if the sub path is not closed, then do nothing.
        return cmds;
      }

      const numCommands = cmds.length;
      if (shouldReverseFn(subIdx)) {
        shiftOffset *= -1;
        shiftOffset += numCommands - 1;
      }

      // If the last command is a 'Z', replace it with a line before we shift.
      const lastCmd = _.last(cmds);
      if (lastCmd.svgChar === 'Z') {
        // TODO: avoid this... replacing the 'Z' can cause undesireable side effects.
        cmds[numCommands - 1] = newLine(lastCmd.start, lastCmd.end, lastCmd.isSplit);
      }

      const newCmds: Command[] = [];

      // Handle these case separately cause they are annoying and I'm sick of edge cases.
      if (shiftOffset === 1) {
        newCmds.push(newMove(_.first(cmds).start, cmds[1].end));
        for (let i = 2; i < cmds.length; i++) {
          newCmds.push(cmds[i]);
        }
        newCmds.push(cmds[1]);
        return newCmds;
      } else if (shiftOffset === numCommands - 1) {
        newCmds.push(newMove(_.first(cmds).start, cmds[numCommands - 2].end));
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

    const reorderedCommands = _.flatMap(newCommandMutationsMap, (_, subIdx) => {
      return maybeShiftCommandsFn(subIdx, maybeReverseCommandsFn(subIdx));
    });
    const pathParams: PathParams = {
      commands: reorderedCommands,
      commandMutationsMap: this.commandMutationsMap,
      shiftOffsets: this.shiftOffsets,
      reversals: this.reversals,
    };
    // TODO: using assign here is kinda weird...
    return new PathImpl(_.assign({}, pathParams, params));
  }

  // Implements the Path interface.
  getPathString() {
    if (_.isUndefined(this.pathString)) {
      const commands =
        _.flatMap(this.getSubPaths(), subPath => subPath.getCommands() as Command[]);
      this.pathString = PathParser.commandsToString(commands);
    }
    return this.pathString;
  }

  // Implements the Path interface.
  getSubPaths() {
    return this.subPaths;
  }

  // Implements the Path interface.
  getPathLength() {
    if (_.isUndefined(this.pathLength)) {
      // Note that we only return the length of the first sub path due to
      // https://code.google.com/p/android/issues/detail?id=172547
      this.pathLength = _.sum(this.commandMutationsMap[0].map(cm => cm.getPathLength()));
    }
    return this.pathLength;
  }

  // Implements the Path interface.
  isMorphableWith(path: Path) {
    const scmds1 = this.getSubPaths();
    const scmds2 = path.getSubPaths();
    return scmds1.length === scmds2.length
      && scmds1.every((_, i) =>
        scmds1[i].getCommands().length === scmds2[i].getCommands().length
        && scmds1[i].getCommands().every((__, j) =>
          scmds1[i].getCommands()[j].svgChar === scmds2[i].getCommands()[j].svgChar));
  }

  // Implements the Path interface.
  interpolate(start: Path, end: Path, fraction: number): Path {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }
    const commands: Command[] = [];
    this.getSubPaths().forEach((subCmd, i) => {
      subCmd.getCommands().forEach((cmd, j) => {
        const cmd1 = start.getSubPaths()[i].getCommands()[j];
        const cmd2 = end.getSubPaths()[i].getCommands()[j];
        const points: Point[] = [];
        for (let k = 0; k < cmd1.points.length; k++) {
          const p1 = cmd1.points[k];
          const p2 = cmd2.points[k];
          if (p1 && p2) {
            const px = MathUtil.lerp(p1.x, p2.x, fraction);
            const py = MathUtil.lerp(p1.y, p2.y, fraction);
            points.push(new Point(px, py));
          }
        }
        commands.push(new CommandImpl(cmd.svgChar, cmd.isSplit, points));
      });
    });
    return new PathImpl(commands);
  }

  // Implements the Path interface.
  project(point: Point): { projection: Projection, split: () => Path } | undefined {
    return _.chain(this.commandMutationsMap)
      .map((subPathCms: CommandMutation[], cmsIdx) =>
        subPathCms.map((cm: CommandMutation, cmIdx) => {
          const projection = cm.project(point);
          return {
            projection,
            split: () => this.splitCommandMutation(cmsIdx, cmIdx, projection.t),
          };
        }))
      .flatMap(projections => projections)
      .filter(obj => !!obj.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, undefined)
      .value();
  }

  // Implements the Path interface.
  reverse(subIdx: number) {
    return this.clone({
      reversals: this.reversals.map((r, i) => i === subIdx ? !r : r),
    });
  }

  // Implements the Path interface.
  shiftBack(subIdx: number, numShifts = 1) {
    return this.reversals[subIdx]
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  // Implements the Path interface.
  shiftForward(subIdx: number, numShifts = 1) {
    return this.reversals[subIdx]
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  private shift(
    subIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    const numCommands = this.getSubPaths()[subIdx].getCommands().length;
    if (numCommands <= 1 || !this.getSubPaths()[subIdx].isClosed()) {
      return this;
    }
    return this.clone({
      shiftOffsets: this.shiftOffsets.map((offset, i) => {
        return i === subIdx ? calcOffsetFn(offset, numCommands) : offset;
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
    const { targetCm, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cmIdx, ts.length);
    const commandMutationsMap =
      this.replaceCommandMutation(subIdx, cmIdx, targetCm.splitAtIndex(splitIdx, ts));
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // Implements the Path interface.
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    ops.sort(({ subIdx: s1, cmdIdx: c1 }, { subIdx: s2, cmdIdx: c2 }) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index unsplit operations.
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
    const { targetCm, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cmIdx, 1);
    const commandMutationsMap =
      this.replaceCommandMutation(subIdx, cmIdx, targetCm.splitInHalfAtIndex(splitIdx));
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // Same as split above, except can be used when the command mutation indices are known.
  // This method specifically only handles one t value (since multi-spliting involves
  // recalculating shift indices in weird ways).
  private splitCommandMutation(subIdx: number, cmIdx: number, t: number) {
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cmIdx, 1);
    const targetCm = this.commandMutationsMap[subIdx][cmIdx];
    const commandMutationsMap =
      this.replaceCommandMutation(subIdx, cmIdx, targetCm.split([t]));
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // If 0 <= cmIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(subIdx: number, cmIdx: number, numSplits: number) {
    const shiftOffsets = this.shiftOffsets.slice();
    const shiftOffset = shiftOffsets[subIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      shiftOffsets[subIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the Path interface.
  unsplit(subIdx: number, cmdIdx: number) {
    const { targetCm, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const commandMutationsMap =
      this.replaceCommandMutation(
        subIdx,
        cmIdx,
        targetCm.unsplitAtIndex(this.reversals[subIdx] ? splitIdx - 1 : splitIdx));
    const shiftOffsets = this.maybeUpdateShiftOffsetsAfterUnsplit(subIdx, cmIdx);
    return this.clone({ commandMutationsMap, shiftOffsets });
  }

  // Subtracts the shift offset by 1 after an unsplit operation if necessary.
  private maybeUpdateShiftOffsetsAfterUnsplit(subIdx: number, cmIdx: number) {
    const shiftOffsets = this.shiftOffsets.slice();
    const shiftOffset = this.shiftOffsets[subIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      shiftOffsets[subIdx] = shiftOffset - 1;
    }
    return shiftOffsets;
  }

  // Implements the Path interface.
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
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
    const { targetCm, cmIdx, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    const commandMutationsMap =
      this.replaceCommandMutation(
        subIdx, cmIdx, targetCm.convertAtIndex(splitIdx, svgChar));
    return this.clone({ commandMutationsMap });
  }

  // Implements the Path interface.
  unconvertSubpath(subIdx: number) {
    const commandMutationsMap = this.commandMutationsMap.map(cms => cms.slice());
    commandMutationsMap[subIdx] =
      commandMutationsMap[subIdx].map((cm, i) => i === 0 ? cm : cm.unconvertSubpath());
    return this.clone({ commandMutationsMap });
  }

  // Implements the Path interface.
  revert() {
    return new PathImpl(
      _.chain(this.commandMutationsMap)
        .flatMap(cms => cms)
        .map(cm => cm.backingCommand)
        .value());
  }

  /**
   * Finds and returns the command mutation at the specified indices.
   * @param subIdx the client-visible subpath index
   * @param cmdIdx the client-visible command index
   */
  private findCommandMutation(subIdx: number, cmdIdx: number) {
    const numCommands = this.getSubPaths()[subIdx].getCommands().length;
    if (cmdIdx && this.reversals[subIdx]) {
      cmdIdx = numCommands - cmdIdx;
    }
    cmdIdx += this.shiftOffsets[subIdx];
    if (cmdIdx >= numCommands) {
      cmdIdx -= (numCommands - 1);
    }
    let counter = 0;
    let cmIdx = 0;
    for (const targetCm of this.commandMutationsMap[subIdx]) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        const splitIdx = cmdIdx - counter;
        return { targetCm, cmIdx, splitIdx };
      }
      counter += targetCm.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }

  private replaceCommandMutation(subIdx: number, cmIdx: number, cm: CommandMutation) {
    const newCms = this.commandMutationsMap.map(cms => cms.slice());
    newCms[subIdx][cmIdx] = cm;
    return newCms;
  }

  // Implements the Path interface.
  splitSubpath(
    subIdx: number,
    split1: { cmdIdx: number, t: number },
    split2?: { cmdIdx: number, t: number }) {

    // Not yet implemented.
    return this;
  }
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

/**
 * Path internals that have been cloned.
 */
interface PathParams {
  readonly commands?: ReadonlyArray<Command>;
  readonly commandMutationsMap?: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  readonly shiftOffsets?: ReadonlyArray<number>;
  readonly reversals?: ReadonlyArray<boolean>;
}
