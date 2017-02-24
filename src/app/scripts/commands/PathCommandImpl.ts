import * as _ from 'lodash';
import { MathUtil, Point } from '../common';
import { PathCommand, SubPathCommand, Command, SvgChar, Projection } from '.';
import { PathParser } from '../parsers';
import { newSubPathCommand } from './SubPathCommandImpl';
import { CommandImpl, newMove, newLine } from './CommandImpl';
import { CommandMutation } from './CommandMutation';

export function newPathCommand(path: string): PathCommand {
  return new PathCommandImpl(path);
}

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute. Also provides mechanisms for
 * splitting/unsplitting/converting/etc. paths in a way that is easily reversible.
 */
class PathCommandImpl implements PathCommand {

  // TODO: forbid multi-closepath cases
  // TODO: consider reversing M C C L Z
  // TODO: reversing a path with a mix of Ls and Cs doesnt work.
  // TODO: reversing a path with a close path with identical start/end points doesn't work
  // TODO: consider an svg that ends with Z and one that doesn't. how to make these morphable?
  private readonly path_: string;
  private readonly subPaths: ReadonlyArray<SubPathCommand>;
  private readonly commandMutationsMap_: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly reversals_: ReadonlyArray<boolean>;
  private readonly pathLength_: number;

  // TODO: add method to calculate bounds and length
  constructor(obj: string | CommandImpl[] | PathCommandParams) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      if (typeof obj === 'string') {
        this.path_ = obj;
        this.subPaths = createSubPathCommands(...PathParser.parseCommands(obj));
      } else {
        this.path_ = PathParser.commandsToString(obj);
        this.subPaths = createSubPathCommands(...obj);
      }
      this.commandMutationsMap_ =
        this.subPaths.map(s => s.getCommands().map(c => new CommandMutation(c as CommandImpl)));
      this.shiftOffsets_ = this.subPaths.map(_ => 0);
      this.reversals_ = this.subPaths.map(_ => false);
    } else {
      this.path_ = PathParser.commandsToString(obj.commands_);
      this.subPaths = createSubPathCommands(...obj.commands_);
      this.commandMutationsMap_ = obj.commandMutationsMap_.map(cms => cms.slice());
      this.shiftOffsets_ = obj.shiftOffsets_.slice();
      this.reversals_ = obj.reversals_.slice();
    }
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    this.pathLength_ =
      this.commandMutationsMap_[0]
        .map(cm => cm.pathLength())
        .reduce((prev, curr) => prev + curr);
  }

  // Implements the PathCommand interface.
  clone(params: PathCommandParams = {}) {
    // TODO: only recompute the stuff that we know has changed...
    const newCommandMutationsMap =
      params.commandMutationsMap_
        ? params.commandMutationsMap_
        : this.commandMutationsMap_;

    const shouldReverseFn = (subIdx: number) =>
      params.reversals_
        ? params.reversals_[subIdx]
        : this.reversals_[subIdx];

    const getShiftOffsetFn = (subIdx: number) =>
      params.shiftOffsets_
        ? params.shiftOffsets_[subIdx]
        : this.shiftOffsets_[subIdx];

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

    // TODO: another edge case: closed paths not ending in a Z
    const maybeShiftCommandsFn = (subIdx: number, cmds: CommandImpl[]) => {
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
        cmds[numCommands - 1] = newLine(lastCmd.start, lastCmd.end, lastCmd.isSplit);
      }

      const newCmds: CommandImpl[] = [];

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
    const pathCommandParams: PathCommandParams = {
      commands_: reorderedCommands,
      commandMutationsMap_: this.commandMutationsMap_,
      shiftOffsets_: this.shiftOffsets_,
      reversals_: this.reversals_,
    };
    // TODO: using assign here is kinda weird...
    return new PathCommandImpl(_.assign({}, pathCommandParams, params));
  }

  get pathString() {
    return this.path_;
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  getSubPaths() {
    return this.subPaths;
  }

  // Implements the PathCommand interface.
  get pathLength(): number {
    return this.pathLength_;
  }

  // Implements the PathCommand interface.
  isMorphableWith(pathCommand: PathCommand) {
    const scmds1 = this.getSubPaths();
    const scmds2 = pathCommand.getSubPaths();
    return scmds1.length === scmds2.length
      && scmds1.every((_, i) =>
        scmds1[i].getCommands().length === scmds2[i].getCommands().length
        && scmds1[i].getCommands().every((__, j) =>
          scmds1[i].getCommands()[j].svgChar === scmds2[i].getCommands()[j].svgChar));
  }

  // Implements the PathCommand interface.
  interpolate(start: PathCommand, end: PathCommand, fraction: number): PathCommand {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }
    const commands: CommandImpl[] = [];
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
    // TODO: note that this erases all command mutation state... will that be an issue?
    return new PathCommandImpl(commands);
  }

  // Implements the PathCommand interface.
  project(point: Point): { projection: Projection, split: () => PathCommand } | undefined {
    return _.chain(this.commandMutationsMap_)
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

  // Implements the PathCommand interface.
  reverse(subIdx: number) {
    // TODO: add a test for commands with multiple moves but no close paths
    return this.clone({
      reversals_: this.reversals_.map((r, i) => i === subIdx ? !r : r),
    });
  }

  // Implements the PathCommand interface.
  shiftBack(subIdx: number, numShifts = 1) {
    return this.reversals_[subIdx]
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  // Implements the PathCommand interface.
  shiftForward(subIdx: number, numShifts = 1) {
    return this.reversals_[subIdx]
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  private shift(
    subIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    // TODO: add a test for cmds with multiple moves but no close paths
    // TODO: add a test for cmds ending with a Z with the same end point as its prev cmd
    const numCommands = this.getSubPaths()[subIdx].getCommands().length;
    if (numCommands <= 1 || !this.getSubPaths()[subIdx].isClosed()) {
      return this;
    }
    return this.clone({
      shiftOffsets_: this.shiftOffsets_.map((offset, i) => {
        return i === subIdx ? calcOffsetFn(offset, numCommands) : offset;
      }),
    });
  }

  // Implements the PathCommand interface.
  getId(subIdx: number, cmdIdx: number) {
    const { targetCw, splitIdx } = this.findCommandMutation(subIdx, cmdIdx);
    return targetCw.getIdAtIndex(splitIdx);
  }

  // Implements the PathCommand interface.
  split(subIdx: number, cmdIdx: number, ...ts: number[]) {
    if (!ts.length) {
      console.warn('Attempt to split a path with an empty spread argument');
      return this;
    }
    const { targetCw, cmIdx, splitIdx } =
      this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cmIdx, ts.length);
    const newCw = targetCw.splitAtIndex(splitIdx, ts);
    return this.clone({
      commandMutationsMap_: this.replaceCommandMutation(subIdx, cmIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Implements the PathCommand interface.
  splitBatch(ops: Array<{ subIdx: number, cmdIdx: number, ts: number[] }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    ops.sort(({subIdx: s1, cmdIdx: c1}, {subIdx: s2, cmdIdx: c2}) => {
      // Perform higher index splits first so that we don't alter the
      // indices of the lower index unsplit operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: PathCommand = this;
    for (const {subIdx, cmdIdx, ts} of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.split(subIdx, cmdIdx, ...ts);
    }
    return result;
  }

  // Implements the PathCommand interface.
  splitInHalf(subIdx: number, cmdIdx: number) {
    const { targetCw, cmIdx, splitIdx } =
      this.findCommandMutation(subIdx, cmdIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cmIdx, 1);
    const newCw = targetCw.splitInHalfAtIndex(splitIdx);
    return this.clone({
      commandMutationsMap_: this.replaceCommandMutation(subIdx, cmIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Same as split above, except can be used when the command mutation indices are known.
  // This method specifically only handles one t value (since multi-spliting involves
  // recalculating shift indices in weird ways).
  private splitCommandMutation(cmsIdx: number, cmIdx: number, t: number) {
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, 1);
    const targetCw = this.commandMutationsMap_[cmsIdx][cmIdx];
    return this.clone({
      commandMutationsMap_: this.replaceCommandMutation(cmsIdx, cmIdx, targetCw.split([t])),
      shiftOffsets_: shiftOffsets,
    });
  }

  // If 0 <= cmIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(
    cmsIdx: number, cmIdx: number, numSplits: number) {

    const shiftOffsets = this.shiftOffsets_.slice();
    const shiftOffset = shiftOffsets[cmsIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      shiftOffsets[cmsIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the PathCommand interface.
  unsplit(subIdx: number, cmdIdx: number) {
    const { targetCw, cmIdx, splitIdx } =
      this.findCommandMutation(subIdx, cmdIdx);
    const newCw =
      targetCw.unsplitAtIndex(this.reversals_[subIdx] ? splitIdx - 1 : splitIdx);
    const shiftOffsets_ = this.shiftOffsets_.slice();
    const shiftOffset = this.shiftOffsets_[subIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      shiftOffsets_[subIdx] = shiftOffset - 1;
    }
    return this.clone({
      commandMutationsMap_: this.replaceCommandMutation(subIdx, cmIdx, newCw),
      shiftOffsets_,
    });
  }

  // Implements the PathCommand interface.
  unsplitBatch(ops: Array<{ subIdx: number, cmdIdx: number }>) {
    if (!ops.length) {
      return this;
    }
    ops = ops.slice();
    ops.sort(({subIdx: s1, cmdIdx: c1}, {subIdx: s2, cmdIdx: c2}) => {
      // Perform higher index unsplits first so that we don't alter the
      // indices of the lower index unsplit operations.
      return s1 !== s2 ? s2 - s1 : c2 - c1;
    });
    let result: PathCommand = this;
    for (const {subIdx, cmdIdx} of ops) {
      // TODO: do all operations as a single batch instead of individually
      result = result.unsplit(subIdx, cmdIdx);
    }
    return result;
  }

  // Implements the PathCommand interface.
  convert(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCw, cmIdx, splitIdx } =
      this.findCommandMutation(subIdx, cmdIdx);
    const newCw = targetCw.convertAtIndex(splitIdx, svgChar);
    return this.clone({
      commandMutationsMap_: this.replaceCommandMutation(subIdx, cmIdx, newCw),
    });
  }

  // Implements the PathCommand interface.
  convertBatch(ops: Array<{ subIdx: number, cmdIdx: number, svgChar: SvgChar }>) {
    if (!ops.length) {
      return this;
    }
    throw new Error('Operation not yet supported');
  }

  // Implements the PathCommand interface.
  unconvert(subIdx: number) {
    const newCmsMap = this.commandMutationsMap_.map(cms => cms.slice());
    newCmsMap[subIdx] =
      newCmsMap[subIdx].map((cm, i) => i === 0 ? cm : cm.unconvert());
    return this.clone({
      commandMutationsMap_: newCmsMap,
    });
  }

  // Implements the PathCommand interface.
  revert() {
    return new PathCommandImpl(
      _.chain(this.commandMutationsMap_)
        .flatMap(cms => cms)
        .map(cm => cm.backingCommand)
        .value());
  }

  private findCommandMutation(subIdx: number, cmdIdx: number) {
    const numCommands = this.getSubPaths()[subIdx].getCommands().length;
    if (cmdIdx && this.reversals_[subIdx]) {
      cmdIdx = numCommands - cmdIdx;
    }
    cmdIdx += this.shiftOffsets_[subIdx];
    if (cmdIdx >= numCommands) {
      cmdIdx -= (numCommands - 1);
    }
    let counter = 0, cmIdx = 0;
    for (const targetCw of this.commandMutationsMap_[subIdx]) {
      if (counter + targetCw.getCommands().length > cmdIdx) {
        const splitIdx = cmdIdx - counter;
        return { targetCw, cmIdx, splitIdx };
      }
      counter += targetCw.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }

  private replaceCommandMutation(cmsIdx: number, cmIdx: number, cm: CommandMutation) {
    const newCms = this.commandMutationsMap_.map(cms => cms.slice());
    newCms[cmsIdx][cmIdx] = cm;
    return newCms;
  }
}

// TODO: create multiple sub path cmds for svgs like 'M ... Z ... Z ... Z'
function createSubPathCommands(...commands: Command[]) {
  if (!commands.length) {
    return [];
  }
  const cmdGroups: Command[][] = [];
  let currentCmdList = [];
  for (let i = commands.length - 1; i >= 0; i--) {
    const cmd = commands[i];
    currentCmdList.push(cmd);
    if (cmd.svgChar === 'M') {
      cmdGroups.push(currentCmdList);
      currentCmdList = [];
    }
  }
  return cmdGroups.reverse().map(cmds => newSubPathCommand(...cmds.reverse()));
}

/**
 * Path command internals that have been cloned.
 */
interface PathCommandParams {
  commands_?: ReadonlyArray<CommandImpl>;
  commandMutationsMap_?: ReadonlyArray<ReadonlyArray<CommandMutation>>;
  shiftOffsets_?: ReadonlyArray<number>;
  reversals_?: ReadonlyArray<boolean>;
}
