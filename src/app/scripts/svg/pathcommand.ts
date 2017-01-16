import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { PathCommand, SubPathCommand, DrawCommand } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { SubPathCommandImpl } from './subpathcommand';
import {
  DrawCommandImpl, moveTo, lineTo, quadraticCurveTo, cubicTo, arcTo, closePath
} from './drawcommand';

/**
 * Implementation of the PathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
class PathCommandImpl implements PathCommand {

  // TODO: fix split/unsplitting paths after reversals/shifts. the indexing is messed up right now
  private commandWrappers_: CommandWrapper[][];
  private shiftOffsets_: number[];
  private commands_: ReadonlyArray<SubPathCommandImpl>;
  private path_: string;
  private isReversed = false;

  // TODO(alockwood): add method to calculate bounds and length
  constructor(obj: string | PathCommandImpl | DrawCommandImpl[]) {
    if (typeof obj === 'string') {
      this.path_ = obj;
      this.commands_ = SubPathCommandImpl.from(...PathParser.parseCommands(obj));
      this.commandWrappers_ = _.map(this.commands_, s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = _.map(this.commands_, _ => 0);
    } else if (obj instanceof PathCommandImpl) {
      const drawCommands =
        _.chain(obj.commandWrappers_)
          .flatMap(cws => cws)
          .flatMap(cw => cw.commands)
          .value();
      this.commands_ = SubPathCommandImpl.from(...drawCommands);
      this.path_ = PathParser.commandsToString(drawCommands);
      this.commandWrappers_ = _.map(obj.commandWrappers_, cws => _.map(cws, cw => cw.clone()));
      this.shiftOffsets_ = obj.shiftOffsets_.slice();
      this.isReversed = obj.isReversed;
    } else {
      this.path_ = PathParser.commandsToString(obj);
      this.commands_ = SubPathCommandImpl.from(...obj);
      this.commandWrappers_ = _.map(this.commands_, s => createCommandWrappers(s.commands));
      this.shiftOffsets_ = _.map(this.commands_, _ => 0);
    }
  }

  clone() {
    return new PathCommandImpl(this);
  }

  toString() {
    return this.path_;
  }

  // Implements the PathCommand interface.
  get commands() {
    // TODO: precompute this
    return this.commands_
      .map(s => {
        if (!this.isReversed) {
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
      })
      .map((s, index) => {
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
      });
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
      .flatMap(cws => cws)
      .map(cw => {
        const projection = cw.project(point);
        return {
          projection,
          split: () => {
            cw.split(projection.t);
            return this.clone();
          }
        };
      })
      .filter(obj => !!obj.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, undefined)
      .value();
  }

  // Implements the PathCommand interface.
  reverse(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    this.isReversed = !this.isReversed;
    return this.clone();
  }

  // Implements the PathCommand interface.
  shiftBack(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    const subPathCommand = this.commands_[subPathIndex];
    const numCommands = subPathCommand.commands.length;
    if (numCommands <= 1 || !subPathCommand.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIndex] - 1;
    if (newShiftOffset < 0) {
      newShiftOffset += numCommands - 1;
    }
    this.shiftOffsets_[subPathIndex] = newShiftOffset;
    return this.clone();
  }

  // Implements the PathCommand interface.
  shiftForward(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    const subPathCommand = this.commands_[subPathIndex];
    const numCommands = subPathCommand.commands.length;
    if (numCommands <= 1 || !subPathCommand.isClosed) {
      return this;
    }
    let newShiftOffset = this.shiftOffsets_[subPathIndex] + 1;
    if (newShiftOffset >= numCommands - 1) {
      newShiftOffset -= numCommands - 1;
    }
    this.shiftOffsets_[subPathIndex] = newShiftOffset;
    return this.clone();
  }

  // Implements the PathCommand interface.
  // split(subPathIndex: number, drawIndex: number) {
  //   return this;
  // }

  // Implements the PathCommand interface.
  unsplit(subPathIndex: number, drawIndex: number) {
    // TODO: indexing is still a bit off here I think...
    // need to make sure we mod the offsets properly after unsplitting
    const numCommands = this.commands_[subPathIndex].commands.length;
    drawIndex += this.shiftOffsets_[subPathIndex];
    if (drawIndex >= numCommands - 1) {
      drawIndex -= numCommands - 1;
    }
    const cws = this.commandWrappers_[subPathIndex];
    let counter = 0;
    let targetCw: CommandWrapper;
    let targetIndex: number;
    for (const cw of cws) {
      if (counter + cw.commands.length > drawIndex) {
        targetCw = cw;
        targetIndex = drawIndex - counter;
        break;
      }
      counter += cw.commands.length;
    }
    targetCw.unsplit(targetIndex);
    return this.clone();
  }
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit at runtime.
 */
class CommandWrapper {

  // TODO(alockwood): possible to have more than one bezier for elliptical arcs?
  private readonly svgChar: string;
  private backingCommand: DrawCommandImpl;
  private backingBeziers: ReadonlyArray<Bezier>;
  private splits: number[] = [];
  private splitCommands: DrawCommandImpl[] = [];

  constructor(obj: DrawCommandImpl | CommandWrapper) {
    if (obj instanceof DrawCommandImpl) {
      this.svgChar = obj.svgChar;
      this.backingCommand = obj;
      this.backingBeziers = drawCommandToBeziers(obj);
    } else {
      this.svgChar = obj.svgChar;
      this.backingCommand = obj.backingCommand;
      this.backingBeziers = drawCommandToBeziers(obj.backingCommand);
      this.splits = obj.splits.slice();
      this.splitCommands = obj.splitCommands.slice();
    }
  }

  clone() {
    return new CommandWrapper(this);
  }

  project(point: Point): Projection | undefined {
    return this.backingBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, undefined);
  }

  // TODO(alockwood): add a test for splitting a command with a path length of 0
  split(t: number) {
    if (!this.backingBeziers.length) {
      return;
    }
    if (this.svgChar === 'A') {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    this.splits.splice(_.sortedIndex(this.splits, t), 0, t);
    this.rebuildSplitCommands();
  }

  unsplit(splitIndex: number) {
    this.splits.splice(splitIndex, 1);
    this.rebuildSplitCommands();
  }

  // TODO: make this entirely immutable...
  private rebuildSplitCommands() {
    this.splitCommands = [];
    if (!this.splits.length) {
      return;
    }
    const splits = [...this.splits, 1];
    let prevT = 0;
    for (let i = 0; i < splits.length; i++) {
      const currT = splits[i];
      const splitBez = this.backingBeziers[0].split(prevT, currT);
      this.splitCommands.push(this.bezierToDrawCommand(splitBez, i !== splits.length - 1));
      prevT = currT;
    }
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
      return cubicTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
    } else {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
  }

  get commands() {
    return this.splitCommands.length ? this.splitCommands : [this.backingCommand];
  }
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
