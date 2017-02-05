import * as _ from 'lodash';
import { MathUtil, Point, Matrix, Rect, SvgUtil } from '../common';
import { PathHelper, newPathHelper } from './pathhelper';
import { PathCommand, SubPathCommand, Command, SvgChar, Projection } from '.';
import { PathParser } from '../parsers';
import { newSubPathCommand } from './SubPathCommandImpl';
import {
  CommandImpl, newMove, newLine, newQuadraticCurve, newBezierCurve, newArc, newClosePath
} from './CommandImpl';
import { PathCommandState, CommandState } from './PathCommandState';

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
  private readonly subPathCommands_: ReadonlyArray<SubPathCommand>;
  private readonly commandWrappers_: PathCommandState;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly reversals_: ReadonlyArray<boolean>;
  private readonly pathLength_: number;

  // TODO: add method to calculate bounds and length
  constructor(obj: string | CommandImpl[] | PathCommandParams) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      if (typeof obj === 'string') {
        this.path_ = obj;
        this.subPathCommands_ =
          createSubPathCommands(...PathParser.parseCommands(obj));
      } else {
        this.path_ = PathParser.commandsToString(obj);
        this.subPathCommands_ = createSubPathCommands(...obj);
      }
      this.commandWrappers_ =
        this.subPathCommands_.map(s => s.commands.map(c => new CommandState(c)));
      this.shiftOffsets_ = this.subPathCommands_.map(_ => 0);
      this.reversals_ = this.subPathCommands_.map(_ => false);
    } else {
      this.path_ = PathParser.commandsToString(obj.drawCommands_);
      this.subPathCommands_ = createSubPathCommands(...obj.drawCommands_);
      this.commandWrappers_ = obj.commandWrappers_.map(cws => cws.slice());
      this.shiftOffsets_ = obj.shiftOffsets_.slice();
      this.reversals_ = obj.reversals_.slice();
    }
    // Note that we only return the length of the first sub path due to
    // https://code.google.com/p/android/issues/detail?id=172547
    this.pathLength_ =
      this.commandWrappers_[0]
        .map(cw => cw.pathLength())
        .reduce((prev, curr) => prev + curr);
  }

  // Implements the PathCommand interface.
  clone(params: PathCommandParams = {}) {
    // TODO: only recompute the stuff that we know has changed...
    const newCmdWrappers =
      params.commandWrappers_
        ? params.commandWrappers_
        : this.commandWrappers_;

    const shouldReverseFn = (subIdx: number) =>
      params.reversals_
        ? params.reversals_[subIdx]
        : this.reversals_[subIdx];

    const getShiftOffsetFn = (subIdx: number) =>
      params.shiftOffsets_
        ? params.shiftOffsets_[subIdx]
        : this.shiftOffsets_[subIdx];

    const maybeReverseCommandsFn = (subIdx: number) => {
      const subPathCws = newCmdWrappers[subIdx];
      const hasOneCmd =
        subPathCws.length === 1 && _.first(subPathCws).commands.length === 1;
      if (hasOneCmd || !shouldReverseFn(subIdx)) {
        // Nothing to do in these two cases.
        return _.flatMap(subPathCws, cw => cw.commands as CommandImpl[]);
      }

      // Extract the commands from our command wrapper map.
      const cmds = _.flatMap(subPathCws, cw => {
        // Consider a segment A ---- B ---- C with AB split and
        // BC non-split. When reversed, we want the user to see
        // C ---- B ---- A w/ CB split and BA non-split.
        const cwCmds = cw.commands.slice();
        if (cwCmds[0].svgChar === 'M') {
          return cwCmds;
        }
        cwCmds[0] = _.first(cwCmds).toggleSplit();
        cwCmds[cwCmds.length - 1] = _.last(cwCmds).toggleSplit();
        return cwCmds;
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

      const newCmds = [];

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

      // The first start point will either be undefined, or the end point of the previous sub path.
      const prevMoveCmd = newCmds.splice(numCommands - shiftOffset, 1)[0];
      newCmds.push(newCmds.shift());
      newCmds.unshift(newMove(prevMoveCmd.start, _.last(newCmds).end));
      return newCmds;
    };

    const drawCommands = _.flatMap(newCmdWrappers, (_, subIdx) => {
      return maybeShiftCommandsFn(subIdx, maybeReverseCommandsFn(subIdx));
    });
    // TODO: using assign here is kinda weird...
    return new PathCommandImpl(_.assign({}, {
      drawCommands_: drawCommands,
      commandWrappers_: this.commandWrappers_,
      shiftOffsets_: this.shiftOffsets_,
      reversals_: this.reversals_,
    }, params));
  }

  get pathString() {
    return this.path_;
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  get subPathCommands() {
    return this.subPathCommands_;
  }

  // Implements the PathCommand interface.
  get pathLength(): number {
    return this.pathLength_;
  }

  // Implements the PathCommand interface.
  isMorphableWith(pathCommand: PathCommand) {
    // TODO: this starts returning false after auto-fixing multiple times
    const scmds1 = this.subPathCommands;
    const scmds2 = pathCommand.subPathCommands;
    return scmds1.length === scmds2.length
      && scmds1.every((_, i) =>
        scmds1[i].commands.length === scmds2[i].commands.length
        && scmds1[i].commands.every((__, j) =>
          scmds1[i].commands[j].svgChar === scmds2[i].commands[j].svgChar));
  }

  // Implements the PathCommand interface.
  interpolate(start: PathCommand, end: PathCommand, fraction: number): PathCommand {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }

    const commands: CommandImpl[] = [];
    this.subPathCommands.forEach((s, i) => {
      s.commands.forEach((d, j) => {
        if (d.svgChar === 'A') {
          const d1 = start.subPathCommands[i].commands[j];
          const d2 = end.subPathCommands[i].commands[j];
          const args = d.args.slice();
          args.forEach((_, k) => {
            if (k === 5 || k === 6) {
              // Doesn't make sense to interpolate the large arc and sweep flags.
              // TODO: confirm this is how arcs are interpolated in android?
              args[k] = fraction === 0 ? d1.args[k] : d2.args[k];
              return;
            }
            args[k] = MathUtil.lerp(d1.args[k], d2.args[k], fraction);
          });
          const points = [new Point(args[0], args[1]), new Point(args[7], args[8])];
          commands.push(new CommandImpl(d.svgChar, d.isSplit, points, ...args));
        } else {
          const d1 = start.subPathCommands[i].commands[j];
          const d2 = end.subPathCommands[i].commands[j];
          const points = [];
          for (let k = 0; k < d1.points.length; k++) {
            const startPoint = d1.points[k];
            const endPoint = d2.points[k];
            if (startPoint && endPoint) {
              const px = MathUtil.lerp(startPoint.x, endPoint.x, fraction);
              const py = MathUtil.lerp(startPoint.y, endPoint.y, fraction);
              points.push(new Point(px, py));
            }
          }
          commands.push(new CommandImpl(d.svgChar, d.isSplit, points));
        }
      });
    });

    return new PathCommandImpl(commands);
  }

  // Implements the PathCommand interface.
  project(point: Point): { projection: Projection, split: () => PathCommand } | undefined {
    return _.chain(this.commandWrappers_)
      .map((subPathCws: CommandState[], cwsIdx) =>
        subPathCws.map((cw: CommandState, cwIdx) => {
          const projection = cw.project(point);
          return {
            projection,
            split: () => this.splitCommandWrapper(cwsIdx, cwIdx, projection.t),
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
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    return this.clone({
      reversals_: this.reversals_.map((r, i) => i === subIdx ? !r : r),
    });
  }

  // Implements the PathCommand interface.
  shiftBack(subIdx: number, numShifts = 1) {
    return this.reversals_[subIdx]
      ? this.shift(subIdx, (o, n) =>  MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  // Implements the PathCommand interface.
  shiftForward(subIdx: number, numShifts = 1) {
    return this.reversals_[subIdx]
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) =>  MathUtil.floorMod(o - numShifts, n - 1));
  }

  private shift(
    subIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    // TODO: add a test for cmds with multiple moves but no close paths
    // TODO: add a test for cmds ending with a Z with the same end point as its prev cmd
    const numCommands = this.subPathCommands_[subIdx].commands.length;
    if (numCommands <= 1 || !this.subPathCommands_[subIdx].isClosed) {
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
    const { targetCw, splitIdx } = this.findCommandWrapper(subIdx, cmdIdx);
    return targetCw.getIdAtIndex(splitIdx);
  }

  // Implements the PathCommand interface.
  split(subIdx: number, cmdIdx: number, ...ts: number[]) {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, cmdIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cwIdx, ts.length);
    const newCw = targetCw.splitAtIndex(splitIdx, ts);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
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
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, cmdIdx);
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(subIdx, cwIdx, 1);
    const newCw = targetCw.splitInHalfAtIndex(splitIdx);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Same as split above, except can be used when the command wrapper indices are known.
  // This method specifically only handles one t value (since multi-spliting involves
  // recalculating shift indices in weird ways).
  private splitCommandWrapper(cwsIdx: number, cwIdx: number, t: number) {
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(cwsIdx, cwIdx, 1);
    const targetCw = this.commandWrappers_[cwsIdx][cwIdx];
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(cwsIdx, cwIdx, targetCw.split([t])),
      shiftOffsets_: shiftOffsets,
    });
  }

  // If 0 <= cwIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(
    cwsIdx: number, cwIdx: number, numSplits: number) {

    const shiftOffsets = this.shiftOffsets_.slice();
    const shiftOffset = shiftOffsets[cwsIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      shiftOffsets[cwsIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the PathCommand interface.
  unsplit(subIdx: number, cmdIdx: number) {
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, cmdIdx);
    const newCw =
      targetCw.unsplitAtIndex(this.reversals_[subIdx] ? splitIdx - 1 : splitIdx);
    const shiftOffsets_ = this.shiftOffsets_.slice();
    const shiftOffset = this.shiftOffsets_[subIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      shiftOffsets_[subIdx] = shiftOffset - 1;
    }
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
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
    const { targetCw, cwIdx, splitIdx } =
      this.findCommandWrapper(subIdx, cmdIdx);
    const newCw = targetCw.convertAtIndex(splitIdx, svgChar);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subIdx, cwIdx, newCw),
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
  revert(): PathCommand {
    return new PathCommandImpl(
      _.chain(this.commandWrappers_)
        .flatMap(cws => cws)
        .map(cw => cw.backingCommand)
        .value());
  }

  private findCommandWrapper(subIdx: number, cmdIdx: number) {
    const numCommands = this.subPathCommands_[subIdx].commands.length;
    if (cmdIdx && this.reversals_[subIdx]) {
      cmdIdx = numCommands - cmdIdx;
    }
    cmdIdx += this.shiftOffsets_[subIdx];
    if (cmdIdx >= numCommands) {
      cmdIdx -= (numCommands - 1);
    }
    let counter = 0, cwIdx = 0;
    for (const targetCw of this.commandWrappers_[subIdx]) {
      if (counter + targetCw.commands.length > cmdIdx) {
        const splitIdx = cmdIdx - counter;
        return { targetCw, cwIdx, splitIdx };
      }
      counter += targetCw.commands.length;
      cwIdx++;
    }
    throw new Error('Error retrieving command wrapper');
  }

  private replaceCommandWrapper(cwsIdx: number, cwIdx: number, cw: CommandState) {
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[cwsIdx][cwIdx] = cw;
    return newCws;
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
  drawCommands_?: ReadonlyArray<CommandImpl>;
  commandWrappers_?: ReadonlyArray<ReadonlyArray<CommandState>>;
  shiftOffsets_?: ReadonlyArray<number>;
  reversals_?: ReadonlyArray<boolean>;
}
