import * as _ from 'lodash';
import { MathUtil, Bezier, createBezier, Projection, Point, Matrix, Rect } from '../common';
import { PathCommand, SubPathCommand, DrawCommand, SvgChar } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { createSubPathCommand } from './subpathcommand';
import {
  DrawCommandImpl, moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './drawcommand';
import * as VectAlign from './vectalign';
import { Alignment } from './vectalign';

export function createPathCommand(path: string): PathCommand {
  return new PathCommandImpl(path);
}

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  // TODO: forbid multi-closepath cases
  // TODO: consider reversing M C C L Z
  // TODO: reversing a path with a mix of Ls and Cs doesnt work.
  // TODO: reversing a path with a close path with identical start/end points doesn't work
  // TODO: consider an svg that ends with Z and one that doesn't. how to make these morphable?
  private readonly path_: string;
  private readonly subPathCommands_: ReadonlyArray<SubPathCommand>;
  private readonly commandWrappers_: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly reversals_: ReadonlyArray<boolean>;

  // TODO: add method to calculate bounds and length
  constructor(obj: string | DrawCommandImpl[] | ClonedPathCommandInfo) {
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
        this.subPathCommands_.map(s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = this.subPathCommands_.map(_ => 0);
      this.reversals_ = this.subPathCommands_.map(_ => false);
    } else {
      this.path_ = PathParser.commandsToString(obj.drawCommands_);
      this.subPathCommands_ = createSubPathCommands(...obj.drawCommands_);
      this.commandWrappers_ = obj.commandWrappers_.map(cws => cws.slice());
      this.shiftOffsets_ = obj.shiftOffsets_.slice();
      this.reversals_ = obj.reversals_.slice();
    }
  }

  // Implements the PathCommand interface.
  clone(overrides: ClonedPathCommandInfo = {}) {
    // TODO: only recompute the stuff that we know has changed...
    const newCmdWrappers =
      overrides.commandWrappers_
        ? overrides.commandWrappers_
        : this.commandWrappers_;

    const shouldReverseFn = (subPathIdx: number) =>
      overrides.reversals_
        ? overrides.reversals_[subPathIdx]
        : this.reversals_[subPathIdx];

    const getShiftOffsetFn = (subPathIdx: number) =>
      overrides.shiftOffsets_
        ? overrides.shiftOffsets_[subPathIdx]
        : this.shiftOffsets_[subPathIdx];

    const maybeReverseCommandsFn = (subPathIdx: number) => {
      const subPathCws = newCmdWrappers[subPathIdx];
      const hasOneDrawCmd =
        subPathCws.length === 1 && _.first(subPathCws).commands.length === 1;
      if (hasOneDrawCmd || !shouldReverseFn(subPathIdx)) {
        // Nothing to do in these two cases.
        return _.flatMap(subPathCws, cw => cw.commands as DrawCommandImpl[]);
      }

      // Extract the draw commands from our command wrapper map.
      const drawCmds = _.flatMap(subPathCws, cw => {
        // Consider a segment A ---- B ---- C with AB split and
        // BC non-split. When reversed, we want the user to see
        // C ---- B ---- A w/ CB split and BA non-split.
        const cmds = cw.commands.slice();
        cmds[0] = _.first(cmds).toggleSplit();
        cmds[cmds.length - 1] = _.last(cmds).toggleSplit();
        return cmds;
      });


      // If the last command is a 'Z', replace it with a line before we reverse.
      const lastCmd = _.last(drawCmds);
      if (lastCmd.svgChar === 'Z') {
        drawCmds[drawCmds.length - 1] = lineTo(lastCmd.start, lastCmd.end);
      }

      // Reverse the draw commands.
      const newDrawCmds = [moveTo(_.first(drawCmds).start, _.last(drawCmds).end)];
      for (let i = drawCmds.length - 1; i > 0; i--) {
        newDrawCmds.push(drawCmds[i].reverse());
      }

      return newDrawCmds;
    };

    // TODO: another edge case: closed paths not ending in a Z
    const maybeShiftCommandsFn = (subPathIdx: number, drawCmds: DrawCommandImpl[]) => {
      let shiftOffset = getShiftOffsetFn(subPathIdx);
      if (!shiftOffset
        || drawCmds.length === 1
        || !_.first(drawCmds).end.equals(_.last(drawCmds).end)) {
        // If there is no shift offset, the sub path is one command long,
        // or if the sub path is not closed, then do nothing.
        return drawCmds;
      }

      const numCommands = drawCmds.length;
      if (shouldReverseFn(subPathIdx)) {
        shiftOffset *= -1;
        shiftOffset += numCommands - 1;
      }

      // If the last command is a 'Z', replace it with a line before we shift.
      const lastCmd = _.last(drawCmds);
      if (lastCmd.svgChar === 'Z') {
        drawCmds[drawCmds.length - 1] = lineTo(lastCmd.start, lastCmd.end);
      }

      // Shift the sequence of drawing commands. After the shift, the original move
      // command will be at index 'numCommands - shiftOffset'.
      const newDrawCmds = [];
      for (let i = 0; i < drawCmds.length; i++) {
        newDrawCmds.push(drawCmds[(i + shiftOffset) % drawCmds.length]);
      }

      // The first start point will either be undefined, or the end point of the previous sub path.
      const prevMoveCmd = newDrawCmds.splice(numCommands - shiftOffset, 1)[0];
      newDrawCmds.unshift(moveTo(prevMoveCmd.start, newDrawCmds[0].start));
      return newDrawCmds;
    };

    const drawCommands = _.flatMap(newCmdWrappers, (_, subPathIdx) => {
      return maybeShiftCommandsFn(subPathIdx, maybeReverseCommandsFn(subPathIdx));
    });
    return new PathCommandImpl(_.assign({}, {
      drawCommands_: drawCommands,
      commandWrappers_: newCmdWrappers,
      shiftOffsets_: this.shiftOffsets_,
      reversals_: this.reversals_,
    }, overrides));
  }

  get pathString() {
    return this.path_;
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  get subPathCommands(): ReadonlyArray<SubPathCommand> {
    return this.subPathCommands_;
  }

  // Implements the PathCommand interface.
  get pathLength(): number {
    throw new Error('Path length not yet supported');
  }

  // Implements the PathCommand interface.
  isMorphableWith(pathCommand: PathCommand) {
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

    const drawCommands: DrawCommandImpl[] = [];
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
          drawCommands.push(new DrawCommandImpl(d.svgChar, d.isSplit, points, ...args));
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
          drawCommands.push(new DrawCommandImpl(d.svgChar, d.isSplit, points));
        }
      });
    });

    return new PathCommandImpl(drawCommands);
  }

  // Implements the PathCommand interface.
  project(point: Point): { projection: Projection, split: () => PathCommand } | undefined {
    return _.chain(this.commandWrappers_)
      .map((subPathCws, cwsIdx) => subPathCws.map((cw, cwIdx) => {
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
  autoAlign(subPathIndex: number, toPathCmd: PathCommand): PathCommand {
    const createFromCmdGroupsFn = (...pathCommands: PathCommand[]): PathCommand[] => {
      const fromPaths = [];
      for (const p of pathCommands) {
        const numFromCmds = p.subPathCommands[subPathIndex].commands.length;
        for (let i = 0; i < numFromCmds - 1; i++) {
          fromPaths.push(p.shiftBack(subPathIndex, i));
        }
      }
      return fromPaths;
    };

    const fromPaths = createFromCmdGroupsFn(this, this.reverse(subPathIndex));
    const alignments = fromPaths.map(p => {
      const toCmds = toPathCmd.subPathCommands[subPathIndex].commands;
      const fromCmds = p.subPathCommands[subPathIndex].commands;
      return { fromPathCommand: p, alignment: VectAlign.align(fromCmds, toCmds) };
    });

    const pathAlignment = alignments.reduce((prev, curr) => {
      const prevScore = prev.alignment.score;
      const currScore = curr.alignment.score;
      return prevScore > currScore ? prev : curr;
    });

    const countGapsFn = (aligns: Alignment[]) => {
      return aligns.reduce((prev, curr) => {
        return curr.drawCommand ? prev : prev + 1;
      }, 0);
    };

    const numFromGaps = countGapsFn(pathAlignment.alignment.from);
    const numToGaps = countGapsFn(pathAlignment.alignment.to);
    if (numToGaps > 0) {
      // TODO: if the target path contains gaps, we'll probably need to convert
      return pathAlignment.fromPathCommand;
    }
    if (numFromGaps === 0) {
      // If there are no gaps in the from path command, then we're done.
      return pathAlignment.fromPathCommand;
    }

    // TODO: Fill in the empty gaps by adding additional no-op drawing commands.
    // let currAlignmentIndex = 0;
    // let currDrawCmdIndex = 0;
    // let numConsecutiveGaps = 0;
    // const fromCmds = pathAlignment.alignment.from;
    // while (currAlignmentIndex < fromCmds.length) {
    //   if (fromCmds[currAlignmentIndex].drawCommand) {
    //   }
    //   currAlignmentIndex++;
    // }

    return pathAlignment.fromPathCommand;
  }

  // Implements the PathCommand interface.
  reverse(subPathIdx: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    return this.clone({
      reversals_: this.reversals_.map((r, i) => i === subPathIdx ? !r : r),
    });
  }

  // Implements the PathCommand interface.
  shiftBack(subPathIdx: number, numShifts = 1) {
    if (this.reversals_[subPathIdx]) {
      return this.shiftForwardInternal(subPathIdx, numShifts);
    }
    return this.shiftBackInternal(subPathIdx, numShifts);
  }

  // Implements the PathCommand interface.
  shiftForward(subPathIdx: number, numShifts = 1) {
    if (this.reversals_[subPathIdx]) {
      return this.shiftBackInternal(subPathIdx, numShifts);
    }
    return this.shiftForwardInternal(subPathIdx, numShifts);
  }

  private shiftBackInternal(subPathIdx: number, numShifts = 1) {
    return this.shiftInternal(
      subPathIdx, (offset: number, numCommands: number) => {
        return (offset + numShifts) % (numCommands - 1);
      });
  }

  private shiftForwardInternal(subPathIdx: number, numShifts = 1) {
    return this.shiftInternal(
      subPathIdx, (offset: number, numCommands: number) => {
        return MathUtil.floorMod(offset - numShifts, numCommands - 1);
      });
  }

  private shiftInternal(
    subPathIdx: number,
    calcOffsetFn: (offset: number, numCommands: number) => number) {

    // TODO: add a test for cmds with multiple moves but no close paths
    // TODO: add a test for cmds ending with a Z with the same end point as its prev cmd
    const numCommands = this.subPathCommands_[subPathIdx].commands.length;
    if (numCommands <= 1 || !this.subPathCommands_[subPathIdx].isClosed) {
      return this;
    }
    return this.clone({
      shiftOffsets_: this.shiftOffsets_.map((offset, i) => {
        return i === subPathIdx ? calcOffsetFn(offset, numCommands) : offset;
      }),
    });
  }

  // Implements the PathCommand interface.
  split(subPathIdx: number, drawIdx: number, ...ts: number[]) {
    const { cwIdx } = this.findCommandWrapper(subPathIdx, drawIdx);
    return this.splitCommandWrapper(subPathIdx, cwIdx, ...ts);
  }

  // Implements the PathCommand interface.
  // splitInHalf(subPathIdx: number, drawIdx: number) {
  //   const { targetCw, cwCmdIdx, cwDrawCmdIdx } =
  //     this.findCommandWrapper(subPathIdx, drawIdx);
  //   const shiftOffsets =
  //     this.maybeUpdateShiftOffsetsAfterSplit(subPathIdx, cwCmdIdx, 1);
  //   const newCw = targetCw.splitInHalfAtIndex(cwDrawCmdIdx);
  //   return this.clone({
  //     commandWrappers_: this.replaceCommandWrapper(subPathIdx, cwCmdIdx, newCw),
  //     shiftOffsets_: shiftOffsets,
  //   });
  // }

  // Same as split above, except can be used when the command wrapper indices are known.
  private splitCommandWrapper(cwsIdx: number, cwIdx: number, ...ts: number[]) {
    if (!ts.length) {
      return this;
    }
    const shiftOffsets =
      this.maybeUpdateShiftOffsetsAfterSplit(cwsIdx, cwIdx, ts.length);
    const targetCw = this.commandWrappers_[cwsIdx][cwIdx];
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(cwsIdx, cwIdx, targetCw.split(...ts)),
      shiftOffsets_: shiftOffsets,
    });
  }

  // If 0 <= cwIdx <= shiftOffset, then that means we need to add one to the
  // shiftoffset to account for the new split point that is about to be inserted.
  // There should be no need to mod the result, as the split will add a new command
  // to the sub path anyway.
  private maybeUpdateShiftOffsetsAfterSplit(
    cwsIdx: number, cwIdx: number, numSplits: number) {
    if (numSplits > 1) {
      // For example, it is probably possible for us to perform a split that
      // results in points being added both before and after the shifted pivot point.
      throw new Error('Confirm this code works with numSplits > 1 before use');
    }

    const shiftOffsets = this.shiftOffsets_.slice();
    const shiftOffset = shiftOffsets[cwsIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      // TODO: figure out how to make this work when numShifts > 1?
      shiftOffsets[cwsIdx] = shiftOffset + numSplits;
    }
    return shiftOffsets;
  }

  // Implements the PathCommand interface.
  unsplit(subPathIdx: number, drawIdx: number) {
    const { targetCw, cwIdx, splitIdx } = this.findCommandWrapper(subPathIdx, drawIdx);
    const newCw = targetCw.unsplitAtIndex(splitIdx);
    const shiftOffsets = this.shiftOffsets_.slice();
    const shiftOffset = this.shiftOffsets_[subPathIdx];
    if (shiftOffset && cwIdx <= shiftOffset) {
      shiftOffsets[subPathIdx] = shiftOffset - 1;
    }
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subPathIdx, cwIdx, newCw),
      shiftOffsets_: shiftOffsets,
    });
  }

  // Implements the PathCommand interface.
  convert(subPathIdx: number, drawIdx: number, svgChar: SvgChar): PathCommand {
    const { targetCw, cwIdx, splitIdx } = this.findCommandWrapper(subPathIdx, drawIdx);
    const newCw = targetCw.convertAtIndex(splitIdx, svgChar);
    return this.clone({
      commandWrappers_: this.replaceCommandWrapper(subPathIdx, cwIdx, newCw),
    });
  }

  getId(subPathIdx: number, drawIdx: number) {
    const { targetCw, splitIdx } = this.findCommandWrapper(subPathIdx, drawIdx);
    return targetCw.getIdAtIndex(splitIdx);
  }

  private findCommandWrapper(subPathIdx: number, drawIdx: number) {
    const numCommands = this.subPathCommands_[subPathIdx].commands.length;
    if (drawIdx && this.reversals_[subPathIdx]) {
      drawIdx = numCommands - drawIdx;
    }
    drawIdx += this.shiftOffsets_[subPathIdx];
    if (drawIdx >= numCommands) {
      drawIdx -= (numCommands - 1);
    }
    let counter = 0, cwIdx = 0, splitIdx = 0;
    for (const targetCw of this.commandWrappers_[subPathIdx]) {
      if (counter + targetCw.commands.length > drawIdx) {
        splitIdx = drawIdx - counter;
        return { targetCw, cwIdx, splitIdx };
      }
      counter += targetCw.commands.length;
      cwIdx++;
    }
    throw new Error('Error retrieving command wrapper');
  }

  private replaceCommandWrapper(cwsIdx: number, cwIdx: number, cw: CommandWrapper) {
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[cwsIdx][cwIdx] = cw;
    return newCws;
  }
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit/converted at runtime.
 * PathCommands are immutable, stateless objects that depend on CommandWrappers to
 * remember their state.
 */
class CommandWrapper {

  // TODO(alockwood): possible to have more than one bezier for elliptical arcs?
  private readonly backingCommand: DrawCommandImpl;
  private readonly backingBeziers: ReadonlyArray<Bezier>;

  // A command wrapper wraps around the initial SVG draw command and outputs
  // a list of transformed draw commands resulting from splits, unsplits,
  // conversions, etc. If the initial SVG draw command hasn't been modified,
  // then a list containing the initial SVG draw command is returned.
  private readonly drawCommands: ReadonlyArray<DrawCommandImpl>;

  // Precondition: the sizes of these arrays should always be identical.
  private readonly ids: ReadonlyArray<string>;
  private readonly splits: ReadonlyArray<number>;
  private readonly svgChars: ReadonlyArray<SvgChar>;

  constructor(obj: DrawCommandImpl | ClonedCommandWrapperInfo) {
    if (obj instanceof DrawCommandImpl) {
      this.backingCommand = obj;
      this.backingBeziers = drawCommandToBeziers(obj);
      this.ids = [_.uniqueId()];
      this.splits = [1];
      this.svgChars = [this.backingCommand.svgChar];
      this.drawCommands = [obj];
    } else {
      this.backingCommand = obj.backingCommand;
      this.backingBeziers = obj.backingBeziers;
      this.ids = obj.ids.slice();
      this.splits = obj.splits.slice();
      this.svgChars = obj.svgChars.slice();
      this.drawCommands = obj.drawCommands.slice();
    }
  }

  private clone(overrides: ClonedCommandWrapperInfo = {}) {
    return new CommandWrapper(_.assign({}, {
      backingCommand: this.backingCommand,
      backingBeziers: this.backingBeziers,
      ids: this.ids,
      splits: this.splits,
      svgChars: this.svgChars,
      drawCommands: this.drawCommands,
    }, overrides));
  }

  // Note that the projection is performed in relation to the command wrapper's
  // original backing draw command.
  project(point: Point): Projection | undefined {
    return this.backingBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, undefined);
  }

  // Note that the split is performed in relation to the command wrapper's
  // original backing draw command.
  split(...ts: number[]) {
    // TODO: add a test for splitting a command with a path length of 0
    // TODO: add a test for the case when t === 1
    if (!ts.length || !this.backingBeziers.length) {
      return this;
    }
    if (this.backingCommand.svgChar === 'A') {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    const ids = this.ids.slice();
    const splits = this.splits.slice();
    const svgChars = this.svgChars.slice();
    for (const t of ts) {
      const insertionIdx = _.sortedIndex(splits, t);
      ids.splice(insertionIdx, 0, _.uniqueId());
      splits.splice(insertionIdx, 0, t);
      // TODO: what about if the last command is a Z? then we want the svg char to be L?
      svgChars.splice(insertionIdx, 0, this.commands[insertionIdx].svgChar);
    }
    return this.rebuildCommands(ids, splits, svgChars);
  }

  // Each draw command is given a globally unique ID (to improve performance
  // inside *ngFor loops, etc.).
  getIdAtIndex(splitIdx: number) {
    return this.ids[splitIdx];
  }

  splitAtIndex(splitIdx: number, ...ts: number[]) {
    const tempSplits = [0, ...this.splits];
    const startSplit = tempSplits[splitIdx];
    const endSplit = tempSplits[splitIdx + 1];
    return this.split(...ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  // TODO: this breaks right now for beziers like (5 11, 5 13, 5 13, 5 13)
  // splitInHalfAtIndex(splitIndex: number) {
  //   const tempSplits = [0, ...this.splits];
  //   const startSplit = tempSplits[splitIndex];
  //   const endSplit = tempSplits[splitIndex + 1];
  //   const distance = MathUtil.lerp(startSplit, endSplit, 0.5);
  //   return this.split(Bezier.findTimeByDistance(this.backingBeziers[0], distance));
  // }

  unsplitAtIndex(splitIdx: number) {
    const ids = this.ids.slice();
    const splits = this.splits.slice();
    const svgChars = this.svgChars.slice();
    ids.splice(splitIdx, 1);
    splits.splice(splitIdx, 1);
    svgChars.splice(splitIdx, 1);
    return this.rebuildCommands(ids, splits, svgChars);
  }

  convertAtIndex(splitIdx: number, svgChar: SvgChar) {
    const svgChars = this.svgChars.slice();
    svgChars[splitIdx] = svgChar;
    return this.rebuildCommands(this.ids.slice(), this.splits.slice(), svgChars);
  }

  // TODO: this could be more efficient (avoid recreating draw commands unnecessarily)
  private rebuildCommands(ids: string[], splits: number[], svgChars: SvgChar[]) {
    if (splits.length === 1) {
      const drawCommands =
        [bezierToDrawCommand(svgChars[0], this.backingBeziers[0], false)];
      return this.clone({ splits, svgChars, ids, drawCommands });
    }
    const drawCommands = [];
    let prevT = 0;
    for (let i = 0; i < splits.length; i++) {
      const currT = splits[i];
      const splitBez = this.backingBeziers[0].split(prevT, currT);
      const isSplit = i !== splits.length - 1;
      drawCommands.push(bezierToDrawCommand(svgChars[i], splitBez, isSplit));
      prevT = currT;
    }
    return this.clone({ ids, splits, svgChars, drawCommands });
  }

  get commands() {
    return this.drawCommands;
  }
}

// TODO: create multiple sub path cmds for svgs like 'M ... Z ... Z ... Z'
function createSubPathCommands(...drawCommands: DrawCommand[]) {
  if (!drawCommands.length) {
    return [];
  }
  const cmdGroups: DrawCommand[][] = [];
  let currentCmdList = [];
  for (let i = drawCommands.length - 1; i >= 0; i--) {
    const cmd = drawCommands[i];
    currentCmdList.push(cmd);
    if (cmd.svgChar === 'M') {
      cmdGroups.push(currentCmdList);
      currentCmdList = [];
    }
  }
  return cmdGroups.reverse().map(cmds => createSubPathCommand(...cmds.reverse()));
}

function createCommandWrappers(commands: ReadonlyArray<DrawCommand>) {
  if (commands.length && commands[0].svgChar !== 'M') {
    throw new Error('First command must be a move');
  }
  return commands.map(cmd => new CommandWrapper(cmd));
}

function bezierToDrawCommand(svgChar: SvgChar, splitBezier: Bezier, isSplit: boolean) {
  const bez = splitBezier;
  if (svgChar === 'L') {
    return lineTo(bez.start, bez.end, isSplit);
  } else if (svgChar === 'Z') {
    return closePath(bez.start, bez.end, isSplit);
  } else if (svgChar === 'Q') {
    return quadraticCurveTo(bez.start, bez.cp1, bez.end, isSplit);
  } else if (svgChar === 'C') {
    return bezierCurveTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
  } else {
    throw new Error('TODO: implement split for ellpitical arcs');
  }
}

function drawCommandToBeziers(cmd: DrawCommandImpl): Bezier[] {
  if (cmd.svgChar === 'L' || cmd.svgChar === 'Z') {
    const start = cmd.start;
    const cp = new Point(
      MathUtil.lerp(cmd.end.x, cmd.start.x, 0.5),
      MathUtil.lerp(cmd.end.y, cmd.start.y, 0.5));
    const end = cmd.end;
    return [createBezier(start, cp, end)];
  } else if (cmd.svgChar === 'C') {
    return [createBezier(cmd.points[0], cmd.points[1], cmd.points[2], cmd.points[3])];
  } else if (cmd.svgChar === 'Q') {
    return [createBezier(cmd.points[0], cmd.points[1], cmd.points[2])];
  } else if (cmd.svgChar === 'A') {
    const [
      currentPointX, currentPointY,
      rx, ry, xAxisRotation,
      largeArcFlag, sweepFlag,
      endX, endY] = cmd.args;

    if (currentPointX === endX && currentPointY === endY) {
      // Degenerate to point.
      return [];
    }

    if (rx === 0 || ry === 0) {
      // Degenerate to line.
      const start = cmd.start;
      const cp = new Point(
        MathUtil.lerp(cmd.end.x, cmd.start.x, 0.5),
        MathUtil.lerp(cmd.end.y, cmd.start.y, 0.5));
      const end = cmd.end;
      return [createBezier(start, cp, cp, end)];
    }

    const bezierCoords = SvgUtil.arcToBeziers({
      startX: currentPointX,
      startY: currentPointY,
      rx, ry, xAxisRotation,
      largeArcFlag, sweepFlag,
      endX, endY,
    });

    const arcBeziers: Bezier[] = [];
    for (let i = 0; i < bezierCoords.length; i += 8) {
      const bez = createBezier(
        { x: cmd.start.x, y: cmd.start.y },
        { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
        { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
        { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
      arcBeziers.push(bez);
    }
    return arcBeziers;
  }

  return [];
}

// Path command internals that have been cloned.
interface ClonedPathCommandInfo {
  drawCommands_?: ReadonlyArray<DrawCommandImpl>;
  commandWrappers_?: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  shiftOffsets_?: ReadonlyArray<number>;
  reversals_?: ReadonlyArray<boolean>;
}

// Command wrapper internals that have been cloned.
interface ClonedCommandWrapperInfo {
  backingCommand?: DrawCommandImpl;
  backingBeziers?: ReadonlyArray<Bezier>;
  ids?: ReadonlyArray<string>;
  splits?: ReadonlyArray<number>;
  svgChars?: ReadonlyArray<SvgChar>;
  drawCommands?: ReadonlyArray<DrawCommandImpl>;
}

