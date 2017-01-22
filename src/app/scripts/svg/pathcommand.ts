import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { PathCommand, SubPathCommand, DrawCommand, SvgChar } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { createSubPathCommand } from './subpathcommand';
import {
  DrawCommandImpl, moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './drawcommand';
import * as VectAlign from './vectalign';
import { Alignment } from './vectalign';

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  private readonly path_: string;
  private readonly subPathCommands_: ReadonlyArray<SubPathCommand>;
  private readonly commandWrappers_: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly reversals_: ReadonlyArray<boolean>;

  // TODO: add method to calculate bounds and length
  // TODO: fix split/unsplitting paths after reversals/shifts
  // TODO: reversing a shifted path doesn't work yet
  constructor(obj: string | DrawCommandImpl[] | ClonedPathCommandInfo) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      if (typeof obj === 'string') {
        this.path_ = obj;
        this.subPathCommands_ = createSubPathCommands(...PathParser.parseCommands(obj));
      } else {
        this.path_ = PathParser.commandsToString(obj);
        this.subPathCommands_ = createSubPathCommands(...obj);
      }
      this.commandWrappers_ =
        this.subPathCommands_.map(s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = this.subPathCommands_.map(_ => 0);
      this.reversals_ = this.subPathCommands_.map(_ => false);
    } else {
      this.path_ = obj.path_;
      this.subPathCommands_ = obj.subPathCommands_;
      this.commandWrappers_ = obj.commandWrappers_;
      this.shiftOffsets_ = obj.shiftOffsets_;
      this.reversals_ = obj.reversals_;
    }
  }

  // Implements the PathCommand interface.
  clone(overrides: ClonedPathCommandInfo = {}) {
    const newCmdWrappers =
      overrides.commandWrappers_
        ? overrides.commandWrappers_
        : this.commandWrappers_;

    const maybeReverseCommandsFn = (subPathIdx: number) => {
      const shouldReverse =
        overrides.reversals_
          ? overrides.reversals_[subPathIdx]
          : this.reversals_[subPathIdx];

      const cmds = _.flatMap(newCmdWrappers[subPathIdx], (cw: CommandWrapper) => {
        if (!shouldReverse || cw.commands.length === 1) {
          return cw.commands as DrawCommandImpl[];
        }
        const toggleSplitFn = (cmd: DrawCommandImpl) => {
          return new DrawCommandImpl(cmd.svgChar, !cmd.isSplit, cmd.points, ...cmd.args);
        };
        const splitCmds = cw.commands.slice();
        splitCmds[0] = toggleSplitFn(_.first(splitCmds));
        splitCmds[splitCmds.length - 1] = toggleSplitFn(_.last(splitCmds));
        return splitCmds;
      });

      if (!shouldReverse || cmds.length <= 1) {
        return cmds;
      }

      const newCmds: DrawCommandImpl[] = [];
      const firstMove = moveTo(_.first(cmds).start, _.last(cmds).end);
      newCmds.push(firstMove);

      const endsWithClosePath = _.last(cmds).svgChar === 'Z';
      const startingIndex = endsWithClosePath ? cmds.length - 2 : cmds.length - 1;
      const endingIndex = endsWithClosePath ? 2 : 1;
      for (let i = startingIndex; i >= endingIndex; i--) {
        newCmds.push(cmds[i].reverse());
      }

      // TODO: test that this works with non-closed paths...
      if (endsWithClosePath) {
        const lineCmd = lineTo(firstMove.end, newCmds[1].start, _.last(cmds).isSplit);
        newCmds.splice(1, 0, lineCmd);
        // TODO: confirm that passing 'false' is really what we want here?
        newCmds.push(closePath(_.last(newCmds).end, firstMove.end, false));
      }

      return newCmds;
    };

    const maybeShiftCommandsFn = (drawCmds: DrawCommandImpl[], shiftOffset: number) => {
      if (shiftOffset === 0
        || drawCmds.length === 1
        || !drawCmds[0].end.equals(_.last(drawCmds).end)) {
        return drawCmds;
      }
      const cmds = drawCmds.slice();
      const newCmdLists: DrawCommandImpl[][] = [];
      for (let i = 0; i < (cmds.length - shiftOffset - 1); i++) {
        const isClosed = cmds[0].end.equals(_.last(cmds).end);
        const moveStartPoint = cmds[0].start;
        cmds.unshift(cmds.pop());

        if (cmds[0].svgChar === 'Z') {
          const lastCmd = _.last(cmds);
          const isLastCmdSplit = lastCmd.isSplit;
          cmds[cmds.length - 1] = closePath(lastCmd.start, lastCmd.end, isLastCmdSplit);
          cmds[1] = lineTo(cmds[0].start, cmds[0].end, cmds[0].isSplit);
          // TODO(alockwood): start point correct for paths w/ multiple moves?
          cmds[0] = moveTo(moveStartPoint, cmds[1].start, isLastCmdSplit);
        } else {
          cmds[1] = cmds[0];
          // TODO(alockwood): start point correct for paths w/ multiple moves?
          // TODO: confirm that passing 'false' is really what we want here?
          cmds[0] = moveTo(moveStartPoint, _.last(cmds).end, false);
        }
      }
      return cmds;
    };
    const drawCommands = [];
    this.subPathCommands_.forEach((_, subPathIdx) => {
      const cmds = maybeReverseCommandsFn(subPathIdx);
      const shiftOffset =
        overrides.shiftOffsets_ === undefined
          ? this.shiftOffsets_[subPathIdx]
          : overrides.shiftOffsets_[subPathIdx];
      drawCommands.push(...maybeShiftCommandsFn(cmds, shiftOffset));
    });
    const clonedInfo: ClonedPathCommandInfo = {
      path_: PathParser.commandsToString(drawCommands),
      subPathCommands_: createSubPathCommands(...drawCommands),
      commandWrappers_: newCmdWrappers.map(cws => cws.slice()),
      shiftOffsets_: this.shiftOffsets_.slice(),
      reversals_: this.reversals_.slice(),
    };

    return new PathCommandImpl(_.assign({}, clonedInfo, overrides));
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
      .map((cws, subPathIdx) => cws.map((cw, drawIdx) => {
        const projection = cw.project(point);
        return {
          projection,
          split: () => this.splitInternal(subPathIdx, drawIdx, projection.t),
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
    const reversals_ = this.reversals_.slice();
    reversals_[subPathIdx] = !reversals_[subPathIdx];
    return this.clone({ reversals_ });
  }

  // Implements the PathCommand interface.
  shiftBack(subPathIdx: number, numShifts = 1) {
    // TODO: add a test for commands with multiple moves but no close paths
    // TODO: add a test for commands ending with a Z with the same end point as its prev cmd
    const scmd = this.subPathCommands_[subPathIdx];
    const numCommands = scmd.commands.length;
    if (numCommands <= 1 || !scmd.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIdx] + numShifts;
    while (newShiftOffset >= numCommands - 1) {
      newShiftOffset -= numCommands - 1;
    }
    const shiftOffsets_ = this.shiftOffsets_.slice();
    shiftOffsets_[subPathIdx] = newShiftOffset;
    return this.clone({ shiftOffsets_ });
  }

  // Implements the PathCommand interface.
  shiftForward(subPathIdx: number, numShifts = 1) {
    // TODO: add a test for cmds with multiple moves but no close paths
    // TODO: add a test for cmds ending with a Z with the same end point as its prev cmd
    const scmd = this.subPathCommands_[subPathIdx];
    const numCommands = scmd.commands.length;
    if (numCommands <= 1 || !scmd.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIdx] - numShifts;
    while (newShiftOffset < 0) {
      newShiftOffset += numCommands - 1;
    }
    const shiftOffsets_ = this.shiftOffsets_.slice();
    shiftOffsets_[subPathIdx] = newShiftOffset;
    return this.clone({ shiftOffsets_ });
  }

  // Implements the PathCommand interface.
  split(subPathIdx: number, drawIdx: number, ...ts: number[]) {
    if (ts.length === 0) {
      return this;
    }
    const numCommands = this.subPathCommands_[subPathIdx].commands.length;
    if (this.reversals_[subPathIdx]) {
      drawIdx = numCommands - drawIdx - 1;
    }
    drawIdx += this.shiftOffsets_[subPathIdx];
    if (drawIdx > numCommands - 1) {
      drawIdx -= numCommands - 1;
    }
    let counter = 0;
    let targetCw: CommandWrapper;
    let targetIndex: number;
    let cwsDrawIndex = 0;
    for (const cw of this.commandWrappers_[subPathIdx]) {
      if (counter + cw.commands.length > drawIdx) {
        targetCw = cw;
        targetIndex = drawIdx - counter;
        break;
      }
      counter += cw.commands.length;
      cwsDrawIndex++;
    }
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[subPathIdx][cwsDrawIndex] = targetCw.splitAtIndex(targetIndex, ...ts);
    return this.clone({ commandWrappers_: newCws });
  }

  private splitInternal(subPathCwIdx: number, drawCwIdx: number, ...ts: number[]) {
    if (ts.length === 0) {
      return this;
    }
    const pathCws = this.commandWrappers_.map(cws => cws.slice());
    const subPathCws = pathCws[subPathCwIdx];
    subPathCws[drawCwIdx] = subPathCws[drawCwIdx].split(...ts);
    return this.clone({ commandWrappers_: pathCws });
  }

  // Implements the PathCommand interface.
  unsplit(subPathIdx: number, drawIdx: number) {
    const numCommands = this.subPathCommands_[subPathIdx].commands.length;
    if (this.reversals_[subPathIdx]) {
      drawIdx = numCommands - drawIdx - 1;
    }
    drawIdx += this.shiftOffsets_[subPathIdx];
    if (drawIdx >= numCommands - 1) {
      drawIdx -= numCommands - 1;
    }
    let counter = 0;
    let targetCw: CommandWrapper;
    let targetIndex: number;
    let cwsDrawIndex = 0;
    for (const cw of this.commandWrappers_[subPathIdx]) {
      if (counter + cw.commands.length > drawIdx) {
        targetCw = cw;
        targetIndex = drawIdx - counter;
        break;
      }
      counter += cw.commands.length;
      cwsDrawIndex++;
    }

    // TODO: also update shift offsets (so that they don't grow past the number of cmds?)
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[subPathIdx][cwsDrawIndex] = targetCw.unsplit(targetIndex);
    return this.clone({
      commandWrappers_: newCws,
    });
  }
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit at runtime.
 */
class CommandWrapper {

  // TODO(alockwood): possible to have more than one bezier for elliptical arcs?
  private readonly svgChar: SvgChar;
  private readonly backingCommand: DrawCommandImpl;
  private readonly backingBeziers: ReadonlyArray<Bezier>;
  private readonly splits: ReadonlyArray<number>;
  private readonly splitCommands: ReadonlyArray<DrawCommandImpl>;

  constructor(obj: DrawCommandImpl | ClonedCommandWrapperInfo) {
    this.svgChar = obj.svgChar;
    if (obj instanceof DrawCommandImpl) {
      this.backingCommand = obj;
      this.backingBeziers = drawCommandToBeziers(obj);
      this.splits = [];
      this.splitCommands = [];
    } else {
      this.backingCommand = obj.backingCommand;
      this.backingBeziers = obj.backingBeziers;
      this.splits = obj.splits;
      this.splitCommands = obj.splitCommands;
    }
  }

  private clone(overrides: ClonedCommandWrapperInfo = {}) {
    return new CommandWrapper(_.assign({}, {
      svgChar: this.svgChar,
      backingCommand: this.backingCommand,
      backingBeziers: this.backingBeziers,
      splits: this.splits.slice(),
      splitCommands: this.splitCommands.slice(),
    }, overrides));
  }

  project(point: Point): Projection | undefined {
    return this.backingBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, undefined);
  }

  split(...ts: number[]) {
    // TODO(alockwood): add a test for splitting a command with a path length of 0
    if (ts.length === 0 || !this.backingBeziers.length) {
      return this;
    }
    if (this.svgChar === 'A') {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    const splits = this.splits.slice();
    for (const t of ts) {
      splits.splice(_.sortedIndex(splits, t), 0, t);
    }
    return this.rebuildSplitCommands(splits);
  }

  splitAtIndex(splitIndex: number, ...ts: number[]) {
    const tempSplits = [0, ...this.splits, 1];
    const startSplit = tempSplits[splitIndex];
    const endSplit = tempSplits[splitIndex + 1];
    return this.split(...ts.map(t => MathUtil.lerp(startSplit, endSplit, t)));
  }

  unsplit(splitIndex: number) {
    const splits = this.splits.slice();
    splits.splice(splitIndex, 1);
    return this.rebuildSplitCommands(splits);
  }

  private rebuildSplitCommands(newSplits: number[]) {
    const newSplitCommands = [];
    if (!newSplits.length) {
      return this.clone({
        splits: newSplits,
        splitCommands: newSplitCommands,
      });
    }
    const splits = [...newSplits, 1];
    let prevT = 0;
    for (let i = 0; i < splits.length; i++) {
      const currT = splits[i];
      const splitBez = this.backingBeziers[0].split(prevT, currT);
      const isSplit = i !== splits.length - 1;
      let svgChar;
      if (this.svgChar === 'Z' && i !== splits.length - 1) {
        svgChar = 'L';
      } else {
        svgChar = this.svgChar;
      }
      newSplitCommands.push(bezierToDrawCommand(svgChar, splitBez, isSplit));
      prevT = currT;
    }
    return this.clone({
      splits: newSplits,
      splitCommands: newSplitCommands,
    });
  }

  get commands() {
    return this.splitCommands.length ? this.splitCommands : [this.backingCommand];
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
    return [new Bezier(start, cp, end)];
  } else if (cmd.svgChar === 'C') {
    return [new Bezier(cmd.points[0], cmd.points[1], cmd.points[2], cmd.points[3])];
  } else if (cmd.svgChar === 'Q') {
    return [new Bezier(cmd.points[0], cmd.points[1], cmd.points[2])];
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
      return [new Bezier(start, cp, cp, end)];
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
      const bez = new Bezier(
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
  path_?: string;
  subPathCommands_?: ReadonlyArray<SubPathCommand>;
  commandWrappers_?: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  shiftOffsets_?: ReadonlyArray<number>;
  reversals_?: ReadonlyArray<boolean>;
}

// Command wrapper internals that have been cloned.
interface ClonedCommandWrapperInfo {
  svgChar?: SvgChar;
  backingCommand?: DrawCommandImpl;
  backingBeziers?: ReadonlyArray<Bezier>;
  splits?: ReadonlyArray<number>;
  splitCommands?: ReadonlyArray<DrawCommandImpl>;
}

export function createPathCommand(path: string): PathCommand {
  return new PathCommandImpl(path);
}
