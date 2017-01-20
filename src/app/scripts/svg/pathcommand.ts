import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { PathCommand, SubPathCommand, DrawCommand, SvgChar } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { SubPathCommandImpl } from './subpathcommand';
import {
  DrawCommandImpl, moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './drawcommand';

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  private readonly path_: string;
  private readonly subPathCommands_: ReadonlyArray<SubPathCommandImpl>;
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
      this.commandWrappers_ = this.subPathCommands_.map(s => createCommandWrappers(s.commands));
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

    const maybeReverseCommandsFn_ = (subPathIdx: number) => {
      const shouldReverse =
        overrides.reversals_ === undefined
          ? this.reversals_[subPathIdx]
          : overrides.reversals_[subPathIdx];

      const cmds = _.flatMap(newCmdWrappers[subPathIdx], (cw: CommandWrapper) => {
        if (!shouldReverse || cw.commands.length === 1) {
          return cw.commands as DrawCommandImpl[];
        }
        const toggleSplitFn_ = (cmd: DrawCommandImpl) => {
          return new DrawCommandImpl(cmd.svgChar, !cmd.isSplit, cmd.points, ...cmd.args);
        };
        const splitCmds = cw.commands.slice();
        splitCmds[0] = toggleSplitFn_(_.first(splitCmds));
        splitCmds[splitCmds.length - 1] = toggleSplitFn_(_.last(splitCmds));
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
        newCmds.push(closePath(_.last(newCmds).end, firstMove.end, false));
      }

      return newCmds;
    };


    const maybeShiftCommandsFn_ = (drawCmds: DrawCommandImpl[], shiftOffset: number) => {
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
          cmds[0] = moveTo(moveStartPoint, _.last(cmds).end, false);
        }
      }
      console.log(cmds);
      return cmds;
    };
    const drawCommands = [];
    this.subPathCommands_.forEach((_, subPathIdx) => {
      const cmds = maybeReverseCommandsFn_(subPathIdx);
      const shiftOffset =
        overrides.shiftOffsets_ === undefined
          ? this.shiftOffsets_[subPathIdx]
          : overrides.shiftOffsets_[subPathIdx];
      drawCommands.push(...maybeShiftCommandsFn_(cmds, shiftOffset));
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
  get subPathCommands() {
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
        && scmds1[i].commands.every((_, j) =>
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
    const reversals_ = this.reversals_.slice();
    reversals_[subPathIndex] = !reversals_[subPathIndex];
    return this.clone({ reversals_ });
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
    const shiftOffsets_ = this.shiftOffsets_.slice();
    shiftOffsets_[subPathIndex] = newShiftOffset;
    return this.clone({ shiftOffsets_ });
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
    const shiftOffsets_ = this.shiftOffsets_.slice();
    shiftOffsets_[subPathIndex] = newShiftOffset;
    return this.clone({ shiftOffsets_ });
  }

  // Implements the PathCommand interface.
  split(subPathIndex: number, drawIndex: number, t: number) {
    const pathCws = this.commandWrappers_.map(cws => cws.slice());
    const subPathCws = pathCws[subPathIndex];
    subPathCws[drawIndex] = subPathCws[drawIndex].split(t);
    return this.clone({ commandWrappers_: pathCws });
  }

  // Implements the PathCommand interface.
  unsplit(subPathIndex: number, drawIndex: number) {
    const numCommands = this.subPathCommands_[subPathIndex].commands.length;
    if (this.reversals_[subPathIndex]) {
      drawIndex = numCommands - drawIndex - 1;
    }
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

    // TODO: also update the shift offsets (so that they don't grow past the number of commands?)
    const newCws = this.commandWrappers_.map(cws => cws.slice());
    newCws[subPathIndex][cwsDrawIndex] = targetCw.unsplit(targetIndex);
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

function bezierToDrawCommand(svgChar: SvgChar, splitBezier: Bezier, isSplit: boolean) {
  const bez = splitBezier;
  if (svgChar === 'L') {
    return lineTo(bez.start, bez.end, isSplit);
  } else if (svgChar === 'Z') {
    return closePath(bez.start, bez.end);
  } else if (svgChar === 'Q') {
    return quadraticCurveTo(bez.start, bez.cp1, bez.end, isSplit);
  } else if (svgChar === 'C') {
    return bezierCurveTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
  } else {
    throw new Error('TODO: implement split for ellpitical arcs');
  }
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

// Path command internals that have been cloned.
interface ClonedPathCommandInfo {
  path_?: string;
  subPathCommands_?: ReadonlyArray<SubPathCommandImpl>;
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
