import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';
import { SubPathCommand } from './subpathcommand';
import { DrawCommand } from './drawcommand';

/**
 * Implementation of the IPathCommand interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
export class PathCommand implements IPathCommand {
  private commandWrappers_: CommandWrapper[][];
  private commands_: ReadonlyArray<SubPathCommand>;
  private path_: string;

  static from(path: string) {
    return new PathCommand(path);
  }

  // TODO(alockwood): add method to calculate bounds and length
  private constructor(obj: string | CommandWrapper[][]) {
    if (typeof obj === 'string') {
      this.path_ = obj;
      this.commands_ = SubPathCommand.from(...PathParser.parseCommands(obj));
      this.commandWrappers_ = this.commands_.map(s => createCommandWrappers(s.commands));
    } else {
      const drawCommands =
        [].concat.apply([], [].concat.apply([], obj.map(cws => cws)).map(cw => cw.commands));
      this.commands_ = SubPathCommand.from(...drawCommands);
      this.path_ = PathParser.commandsToString(drawCommands);
      this.commandWrappers_ = obj;
    }
  }

  toString() {
    return this.path_;
  }

  // Overrides IPathCommand interface.
  get commands() {
    return this.commands_;
  }

  // Overrides IPathCommand interface.
  get pathLength(): number {
    throw new Error('Path length not yet supported');
  }

  // Overrides IPathCommand interface.
  isMorphableWith(cmd: IPathCommand) {
    return this.commands.length === cmd.commands.length
      && this.commands.every((s, i) => {
        return s.commands.length === cmd.commands[i].commands.length
          && s.commands.every((d, j) => {
            return d.svgChar === cmd.commands[i].commands[j].svgChar;
          });
      });
  }

  // Overrides IPathCommand interface.
  interpolate(start: IPathCommand, end: IPathCommand, fraction: number) {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return;
    }
    // TODO(alockwood): determine if we should make the args/points immutable...
    this.commands.forEach((s, i) => {
      s.commands.forEach((d, j) => {
        if (d.svgChar === 'A') {
          const d1 = start.commands[i].commands[j];
          const d2 = end.commands[i].commands[j];
          const args = d.args as number[];
          args.forEach((_, x) => {
            if (x === 5 || x === 6) {
              // Doesn't make sense to interpolate the large arc and sweep flags.
              args[x] = fraction === 0 ? d1.args[x] : d2.args[x];
              return;
            }
            args[x] = MathUtil.lerp(d1.args[x], d2.args[x], fraction);
          });
        } else {
          const d1 = start.commands[i].commands[j];
          const d2 = end.commands[i].commands[j];
          for (let x = 0; x < d1.points.length; x++) {
            const startPoint = d1.points[x];
            const endPoint = d2.points[x];
            if (startPoint && endPoint) {
              const px = MathUtil.lerp(startPoint.x, endPoint.x, fraction);
              const py = MathUtil.lerp(startPoint.y, endPoint.y, fraction);
              (d.points as Point[])[x] = new Point(px, py);
            }
          }
        }
      });
    });
    // TODO(alockwood): do we need to rebuild any internal state here?
    // if so, we should probably make everything immutable and return a new command object
  }

  // Overrides IPathCommand interface.
  project(point: Point): { projection: Projection, split: () => IPathCommand } | null {
    const drawCommandWrappers: CommandWrapper[] =
      [].concat.apply([], this.commandWrappers_.map(cws => cws));
    return drawCommandWrappers.map(cw => {
      const projection = cw.project(point);
      return {
        projection,
        split: () => {
          cw.split(projection.t);
          return new PathCommand(this.commandWrappers_);
        }
      };
    }).filter(item => !!item.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, null);
  }

  // Overrides IPathCommand interface.
  reverse(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths
    const cws = this.commandWrappers_[subPathIndex];
    const numCommands = cws.reduce((prev, curr) => prev + curr.commands.length, 0);
    if (numCommands <= 1) {
      // TODO: confirm we should do nothing in this case?
      return this;
    }
    const firstCommand = cws[0].commands[0];
    const newCws = [
      cws[0].convert(
        DrawCommand.moveTo(firstCommand.start, _.last(_.last(cws).commands).end)),
    ];
    for (let i = cws.length - 1; i >= 1; i--) {
      newCws.push(cws[i].reverse());
    }
    const secondCmd = newCws[1].commands[0];
    if (secondCmd.svgChar === 'Z') {
      newCws[1].convert(
        DrawCommand.lineTo(secondCmd.start, secondCmd.end, secondCmd.isSplit));
      const lastCmd = _.last(_.last(newCws).commands);
      newCws[newCws.length - 1].convert(
        DrawCommand.closePath(lastCmd.start, lastCmd.end, lastCmd.isSplit));
    }
    this.commandWrappers_[subPathIndex] = newCws;
    return new PathCommand(this.commandWrappers_);
  }

  // Overrides IPathCommand interface.
  shiftBack(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths

    // if (this.commands.length === 1 || !this.isClosed) {
    //   return this;
    // }

    // const newCmdLists: DrawCommand[][] = [];
    // const cmds = this.commands.slice();
    // const moveStartPoint = cmds[0].start;
    // cmds.unshift(cmds.pop());

    // if (cmds[0].svgChar === 'Z') {
    //   const lastCmd = _.last(cmds);
    //   cmds[cmds.length - 1] = DrawCommand.closePath(lastCmd.start, lastCmd.end);
    //   cmds[1] = DrawCommand.lineTo(cmds[0].start, cmds[0].end);
    // } else {
    //   cmds[1] = cmds[0];
    // }
    // // TODO(alockwood): confirm that this start point is correct for paths w/ multiple moves
    // cmds[0] = DrawCommand.moveTo(moveStartPoint, cmds[1].start);

    // return new SubPathCommand(...cmds);

    return this;
  }

  // Overrides IPathCommand interface.
  shiftForward(subPathIndex: number) {
    // TODO(alockwood): add a test for commands with multiple moves but no close paths

    // if (this.commands.length === 1 || !this.isClosed) {
    //   return this;
    // }

    // // TODO(alockwood): make this more efficient... :P
    // let result: SubPathCommand = this;
    // for (let i = 0; i < this.commands.length - 2; i++) {
    //   result = result.shiftBack();
    // }
    // return result;

    return this;
  }

  // Overrides IPathCommand interface.
  // split(subPathIndex: number, drawIndex: number) {
  //   return this;
  // }

  // Overrides IPathCommand interface.
  unsplit(subPathIndex: number, drawIndex: number) {
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
    return new PathCommand(this.commandWrappers_);
  }
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit at runtime.
 */
class CommandWrapper {

  // TODO(alockwood): possible to have more than one bezier for elliptical arcs?
  private readonly svgChar: string;
  private backingCommand: DrawCommand;
  private backingBeziers: Bezier[];
  private splits: number[] = [];
  private splitCommands: DrawCommand[] = [];

  constructor(cmd: DrawCommand) {
    this.svgChar = cmd.svgChar;
    this.backingCommand = cmd;
    this.backingBeziers = drawCommandToBeziers(cmd);
  }

  convert(cmd: DrawCommand) {
    if (this.svgChar === cmd.svgChar
      || (this.svgChar === 'L' && cmd.svgChar === 'Z')
      || (this.svgChar === 'Z' && cmd.svgChar === 'L')) {
      this.backingCommand = cmd;
      this.backingBeziers = drawCommandToBeziers(cmd);
    }
    return this;
  }

  reverse() {
    if (this.svgChar === 'M') {
      return;
    }
    this.backingCommand = this.backingCommand.reverse();
    this.backingBeziers = drawCommandToBeziers(this.backingCommand);
    this.splits = this.splits.map(t => 1 - t).reverse();
    this.rebuildSplitCommands();
    return this;
  }

  project(point: Point): Projection | null {
    return this.backingBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, null);
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
      return DrawCommand.lineTo(bez.start, bez.end, isSplit);
    } else if (this.svgChar === 'Z') {
      return DrawCommand.closePath(bez.start, bez.end, isSplit);
    } else if (this.svgChar === 'Q') {
      return DrawCommand.quadTo(bez.start, bez.cp1, bez.end, isSplit);
    } else if (this.svgChar === 'C') {
      return DrawCommand.cubicTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
    } else {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
  }

  get commands() {
    return this.splitCommands.length ? this.splitCommands : [this.backingCommand];
  }
}

function createCommandWrappers(commands: ReadonlyArray<DrawCommand>) {
  if (commands.length && commands[0].svgChar !== 'M') {
    throw new Error('First command must be a move');
  }
  return commands.map(cmd => new CommandWrapper(cmd));
}

function drawCommandToBeziers(cmd: DrawCommand): Bezier[] {
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
