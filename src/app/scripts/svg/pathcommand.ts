import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { PathCommand, SubPathCommand, DrawCommand, SvgChar } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { SubPathCommandImpl } from './subpathcommand';
import {
  DrawCommandImpl, moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './drawcommand';

// Path command internals that have been cloned.
interface ClonedPathCommandInfo {
  path_?: string;
  subPathCommands_?: ReadonlyArray<SubPathCommandImpl>;
  commandWrappers_?: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  shiftOffsets_?: ReadonlyArray<number>;
  isReversed_?: boolean;
}

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  // TODO: fix split/unsplitting paths after reversals/shifts. the indexing is messed up right now
  private readonly path_: string;
  private readonly subPathCommands_: ReadonlyArray<SubPathCommandImpl>;
  private readonly commandWrappers_: ReadonlyArray<ReadonlyArray<CommandWrapper>>;
  private readonly shiftOffsets_: ReadonlyArray<number>;
  private readonly isReversed_: boolean;

  // TODO(alockwood): add method to calculate bounds and length
  constructor(obj: string | DrawCommandImpl[] | ClonedPathCommandInfo) {
    if (typeof obj === 'string') {
      this.path_ = obj;
      this.subPathCommands_ = createSubPathCommands(...PathParser.parseCommands(obj));
      this.commandWrappers_ = _.map(this.subPathCommands_, s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = _.map(this.subPathCommands_, _ => 0);
      this.isReversed_ = false;
    } else if (Array.isArray(obj)) {
      this.path_ = PathParser.commandsToString(obj);
      this.subPathCommands_ = createSubPathCommands(...obj);
      this.commandWrappers_ = _.map(this.subPathCommands_, s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = _.map(this.subPathCommands_, _ => 0);
      this.isReversed_ = false;
    } else {
      this.path_ = obj.path_;
      this.subPathCommands_ = obj.subPathCommands_;
      this.commandWrappers_ = obj.commandWrappers_;
      this.shiftOffsets_ = obj.shiftOffsets_;
      this.isReversed_ = obj.isReversed_;
    }
  }

  clone(overrides?: ClonedPathCommandInfo) {
    let newCommandWrappers = this.commandWrappers_;
    if (overrides && overrides.commandWrappers_) {
      newCommandWrappers = overrides.commandWrappers_;
    }
    const drawCommands =
      _.chain(newCommandWrappers)
        .flatMap(cws => cws)
        .flatMap(cw => cw.commands)
        .value();
    const clonedInfo: ClonedPathCommandInfo = {
      path_: PathParser.commandsToString(drawCommands),
      subPathCommands_: createSubPathCommands(...drawCommands),
      commandWrappers_: newCommandWrappers.map(cws => cws.slice()),
      shiftOffsets_: this.shiftOffsets_.slice(),
      isReversed_: this.isReversed_,
    };
    return new PathCommandImpl(_.assign({}, clonedInfo, overrides));
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  get commands() {
    // TODO: precompute this
    const reverseSubPath = (s: SubPathCommandImpl) => {
      if (!this.isReversed_) {
        return s;
      }
      const cmds = s.commands;
      const firstMoveCommand = cmds[0];
      if (cmds.length === 1) {
        return new SubPathCommandImpl(firstMoveCommand);
      }
      const newCmds: DrawCommandImpl[] = [
        moveTo(firstMoveCommand.start, _.last(cmds).end),
      ];
      for (let i = cmds.length - 1; i >= 1; i--) {
        newCmds.push(cmds[i].reverse());
      }
      const secondCmd = newCmds[1];
      if (secondCmd.svgChar === 'Z') {
        newCmds[1] = lineTo(secondCmd.start, secondCmd.end);
        const lastCmd = _.last(newCmds);
        newCmds[newCmds.length - 1] = closePath(lastCmd.start, lastCmd.end);
      }
      return new SubPathCommandImpl(...newCmds);
    };
    const shiftSubPath = (s: SubPathCommandImpl, index: number) => {
      const currShiftOffset = this.shiftOffsets_[index];
      if (currShiftOffset === 0) {
        return s;
      }
      if (s.commands.length === 1 || !s.isClosed) {
        return s;
      }
      const newCmdLists: DrawCommandImpl[][] = [];
      const cmds = s.commands.slice();
      for (let i = 0; i < (s.commands.length - currShiftOffset - 1); i++) {
        const isClosed = cmds[0].end.equals(_.last(cmds).end);
        const moveStartPoint = cmds[0].start;
        cmds.unshift(cmds.pop());

        if (cmds[0].svgChar === 'Z') {
          const lastCmd = _.last(cmds);
          cmds[cmds.length - 1] = closePath(lastCmd.start, lastCmd.end);
          cmds[1] = lineTo(cmds[0].start, cmds[0].end);
          // TODO(alockwood): start point correct for paths w/ multiple moves?
          cmds[0] = moveTo(moveStartPoint, cmds[1].start);
        } else {
          cmds[1] = cmds[0];
          // TODO(alockwood): start point correct for paths w/ multiple moves?
          cmds[0] = moveTo(moveStartPoint, _.last(cmds).end);
        }
      }
      return new SubPathCommandImpl(...cmds);
    };
    return this.subPathCommands_
      .map(s => reverseSubPath(s))
      .map((s, i) => shiftSubPath(s, i));
  }

  // Implements the PathCommand interface.
  get pathLength(): number {
    throw new Error('Path length not yet supported');
  }

  // Implements the PathCommand interface.
  isMorphableWith(cmd: PathCommand) {
    return this.commands.length === cmd.commands.length
      && this.commands.every((s, i) => {
        const scmd = cmd.commands[i];
        return s.commands.length === scmd.commands.length
          && s.commands.every((d, j) => {
            const dcmd = scmd.commands[j];
            return d.svgChar === dcmd.svgChar;
          });
      });
  }

  // Implements the PathCommand interface.
  interpolate(start: PathCommand, end: PathCommand, fraction: number): PathCommand {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }

    const drawCommands: DrawCommandImpl[] = [];
    this.commands.forEach((s, i) => {
      s.commands.forEach((d, j) => {
        if (d.svgChar === 'A') {
          const d1 = start.commands[i].commands[j];
          const d2 = end.commands[i].commands[j];
          const args = d.args.slice();
          args.forEach((_, x) => {
            if (x === 5 || x === 6) {
              // Doesn't make sense to interpolate the large arc and sweep flags.
              args[x] = fraction === 0 ? d1.args[x] : d2.args[x];
              return;
            }
            args[x] = MathUtil.lerp(d1.args[x], d2.args[x], fraction);
          });
          const points = [new Point(args[0], args[1]), new Point(args[7], args[8])];
          drawCommands.push(new DrawCommandImpl(d.svgChar, d.isSplit, points, ...args));
        } else {
          const d1 = start.commands[i].commands[j];
          const d2 = end.commands[i].commands[j];
          const points = [];
          for (let x = 0; x < d1.points.length; x++) {
            const startPoint = d1.points[x];
            const endPoint = d2.points[x];
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
          split: () => this.split(subPathIdx, drawIdx, projection.t),
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
  reverse(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    return this.clone({ isReversed_: !this.isReversed_ });
  }

  // Implements the PathCommand interface.
  shiftBack(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    const scmd = this.subPathCommands_[subPathIndex];
    const numCommands = scmd.commands.length;
    if (numCommands <= 1 || !scmd.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIndex] - 1;
    if (newShiftOffset < 0) {
      newShiftOffset += numCommands - 1;
    }
    const shiftOffsets = this.shiftOffsets_.slice();
    shiftOffsets[subPathIndex] = newShiftOffset;
    return this.clone({ shiftOffsets_: shiftOffsets });
  }

  // Implements the PathCommand interface.
  shiftForward(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    const scmd = this.subPathCommands_[subPathIndex];
    const numCommands = scmd.commands.length;
    if (numCommands <= 1 || !scmd.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIndex] + 1;
    if (newShiftOffset >= numCommands - 1) {
      newShiftOffset -= numCommands - 1;
    }
    const shiftOffsets = this.shiftOffsets_.slice();
    shiftOffsets[subPathIndex] = newShiftOffset;
    return this.clone({ shiftOffsets_: shiftOffsets });
  }

  // Implements the PathCommand interface.
  split(subPathIndex: number, drawIndex: number, t: number) {
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[subPathIndex][drawIndex] = newCws[subPathIndex][drawIndex].split(t);
    return this.clone({ commandWrappers_: newCws });
  }

  // Implements the PathCommand interface.
  unsplit(subPathIndex: number, drawIndex: number) {
    // TODO: indexing is still a bit off here I think...
    // doesn't work after reverse/shift/unshifting yet, but shouldn't be too hard to fix.
    // need to make sure we mod the offsets properly after unsplitting as well.
    const numCommands = this.subPathCommands_[subPathIndex].commands.length;
    drawIndex += this.shiftOffsets_[subPathIndex];
    if (drawIndex >= numCommands - 1) {
      drawIndex -= numCommands - 1;
    }
    let counter = 0;
    let targetCw: CommandWrapper;
    let targetIndex: number;
    let cwsDrawIndex = 0;
    for (const cw of this.commandWrappers_[subPathIndex]) {
      if (counter + cw.commands.length > drawIndex) {
        targetCw = cw;
        targetIndex = drawIndex - counter;
        break;
      }
      counter += cw.commands.length;
      cwsDrawIndex++;
    }
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[subPathIndex][cwsDrawIndex] = targetCw.unsplit(targetIndex);
    return this.clone({ commandWrappers_: newCws });
  }
}

// Command wrapper internals that have been cloned.
interface ClonedCommandWrapperInfo {
  svgChar?: SvgChar;
  backingCommand?: DrawCommandImpl;
  backingBeziers?: ReadonlyArray<Bezier>;
  splits?: ReadonlyArray<number>;
  splitCommands?: ReadonlyArray<DrawCommandImpl>;
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
    if (obj instanceof DrawCommandImpl) {
      this.svgChar = obj.svgChar;
      this.backingCommand = obj;
      this.backingBeziers = drawCommandToBeziers(obj);
      this.splits = [];
      this.splitCommands = [];
    } else {
      this.svgChar = obj.svgChar;
      this.backingCommand = obj.backingCommand;
      this.backingBeziers = obj.backingBeziers;
      this.splits = obj.splits;
      this.splitCommands = obj.splitCommands;
    }
  }

  clone(overrides?: ClonedCommandWrapperInfo) {
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

  // TODO(alockwood): add a test for splitting a command with a path length of 0
  split(t: number) {
    if (!this.backingBeziers.length) {
      return this;
    }
    if (this.svgChar === 'A') {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    const splits = this.splits.slice();
    splits.splice(_.sortedIndex(splits, t), 0, t);
    return this.rebuildSplitCommands(splits);
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
      newSplitCommands.push(this.bezierToDrawCommand(splitBez, i !== splits.length - 1));
      prevT = currT;
    }
    return this.clone({
      splits: newSplits,
      splitCommands: newSplitCommands,
    });
  }

  private bezierToDrawCommand(splitBezier: Bezier, isSplit: boolean) {
    const bez = splitBezier;
    if (this.svgChar === 'L') {
      return lineTo(bez.start, bez.end, isSplit);
    } else if (this.svgChar === 'Z') {
      return closePath(bez.start, bez.end, isSplit);
    } else if (this.svgChar === 'Q') {
      return quadraticCurveTo(bez.start, bez.cp1, bez.end, isSplit);
    } else if (this.svgChar === 'C') {
      return bezierCurveTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
    } else {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
  }

  get commands() {
    return this.splitCommands.length ? this.splitCommands : [this.backingCommand];
  }
}

function createSubPathCommands(...drawCommands: DrawCommandImpl[]) {
  if (!drawCommands.length) {
    return [];
  }
  const cmdGroups: DrawCommandImpl[][] = [];
  let currentCmdList = [];
  for (let i = drawCommands.length - 1; i >= 0; i--) {
    const cmd = drawCommands[i];
    currentCmdList.push(cmd);
    if (cmd.svgChar === 'M') {
      cmdGroups.push(currentCmdList);
      currentCmdList = [];
    }
  }
  return cmdGroups.reverse().map(cmds => new SubPathCommandImpl(...cmds.reverse()));
}

function createCommandWrappers(commands: ReadonlyArray<DrawCommandImpl>) {
  if (commands.length && commands[0].svgChar !== 'M') {
    throw new Error('First command must be a move');
  }
  return commands.map(cmd => new CommandWrapper(cmd));
}

function drawCommandToBeziers(cmd: DrawCommandImpl): Bezier[] {
  if (cmd.svgChar === 'L') {
    return [new Bezier(cmd.start, cmd.start, cmd.end, cmd.end)];
  } else if (cmd.svgChar === 'Z') {
    return [new Bezier(cmd.start, cmd.start, cmd.end, cmd.end)];
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
      return [new Bezier(cmd.start, cmd.start, cmd.end, cmd.end)];
    }

    const bezierCoords = SvgUtil.arcToBeziers(
      currentPointX, currentPointY,
      rx, ry, xAxisRotation,
      largeArcFlag, sweepFlag,
      endX, endY);

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

export function createPathCommand(path: string) {
  return new PathCommandImpl(path);
}
