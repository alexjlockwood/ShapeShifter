import * as _ from 'lodash';
import { MathUtil, Bezier, Projection, Point, Matrix, Rect } from '../common';
import { ICommand, IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
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
      this.commandWrappers_ = this.commands_.map(s => createCommandWrappers(...s.commands))
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
    return this;
  }

  // Overrides IPathCommand interface.
  shiftBack(subPathIndex: number) {
    return this;
  }

  // Overrides IPathCommand interface.
  shiftForward(subPathIndex: number) {
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
    for (let cw of cws) {
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

function createCommandWrappers(...commands: DrawCommand[]) {
  if (commands.length && commands[0].svgChar !== 'M') {
    throw new Error('First command must be a move');
  }

  let lastMovePoint;
  let currentPoint;

  const drawCommandWrappers: CommandWrapper[] = [];
  commands.forEach(cmd => {
    if (cmd.svgChar === 'M') {
      lastMovePoint = cmd.points[1];
      drawCommandWrappers.push(new CommandWrapper(cmd));
      currentPoint = cmd.points[1];
    } else if (cmd.svgChar === 'L') {
      drawCommandWrappers.push(
        new CommandWrapper(
          cmd, new Bezier(currentPoint, currentPoint, cmd.points[1], cmd.points[1])));
      currentPoint = cmd.points[1];
    } else if (cmd.svgChar === 'Z') {
      drawCommandWrappers.push(
        new CommandWrapper(
          cmd, new Bezier(currentPoint, currentPoint, lastMovePoint, lastMovePoint)));
      currentPoint = lastMovePoint;
    } else if (cmd.svgChar === 'C') {
      drawCommandWrappers.push(
        new CommandWrapper(
          cmd, new Bezier(currentPoint, cmd.points[1], cmd.points[2], cmd.points[3])));
      currentPoint = cmd.points[3];
    } else if (cmd.svgChar === 'Q') {
      drawCommandWrappers.push(
        new CommandWrapper(cmd, new Bezier(currentPoint, cmd.points[1], cmd.points[2])));
      currentPoint = cmd.points[2];
    } else if (cmd.svgChar === 'A') {
      const [
        currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        endX, endY] = cmd.args;

      if (currentPointX === endX && currentPointY === endY) {
        drawCommandWrappers.push(new CommandWrapper(cmd));
        return;
      }

      if (rx === 0 || ry === 0) {
        // degenerate to line
        const nextPoint = new Point;
        drawCommandWrappers.push(
          new CommandWrapper(cmd, new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
        currentPoint = nextPoint;
        return;
      }

      const bezierCoords = SvgUtil.arcToBeziers(
        currentPointX, currentPointY,
        rx, ry, xAxisRotation,
        largeArcFlag, sweepFlag,
        endX, endY);

      const arcBeziers: Bezier[] = [];
      for (let i = 0; i < bezierCoords.length; i += 8) {
        const bez = new Bezier(
          { x: currentPoint.x, y: currentPoint.y },
          { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
          { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
          { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
        arcBeziers.push(bez);
        currentPoint = new Point(bezierCoords[i + 6], bezierCoords[i + 7]);
      }
      drawCommandWrappers.push(new CommandWrapper(cmd, ...arcBeziers));
      currentPoint = new Point(endX, endY);
    }
  });

  return drawCommandWrappers;
}

/**
 * Contains additional information about each individual draw command so that we can
 * remember how they should be projected onto and split/unsplit at runtime.
 */
class CommandWrapper {

  // TODO(alockwood): possible to have more than one bezier for elliptical arcs?
  private readonly sourceBeziers: ReadonlyArray<Bezier>;
  private readonly splits: number[] = [];
  private readonly splitCommands: DrawCommand[] = [];

  constructor(public readonly sourceCommand: DrawCommand, ...sourceBeziers: Bezier[]) {
    this.sourceBeziers = sourceBeziers;
  }

  project(point: Point): Projection | null {
    return this.sourceBeziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev && prev.d < curr.d ? prev : curr, null);
  }

  // TODO(alockwood): add a test for splitting a command with a path length of 0
  split(t: number) {
    if (!this.sourceBeziers.length) {
      return;
    }
    if (this.sourceCommand.svgChar === 'A') {
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
    this.splitCommands.splice(0, this.splitCommands.length);
    if (!this.splits.length) {
      return;
    }
    const splits = [...this.splits, 1];
    let prevT = 0;
    for (let i = 0; i < splits.length; i++) {
      const currT = splits[i];
      const splitBez = this.sourceBeziers[0].split(prevT, currT);
      this.splitCommands.push(this.bezierToDrawCommand(splitBez, i !== splits.length - 1));
      prevT = currT;
    }
  }

  private bezierToDrawCommand(splitBezier: Bezier, isSplit: boolean) {
    const cmd = this.sourceCommand;
    const bez = splitBezier;
    if (cmd.svgChar === 'L') {
      return DrawCommand.lineTo(bez.start, bez.end, isSplit);
    } else if (cmd.svgChar === 'Z') {
      return DrawCommand.closePath(bez.start, bez.end, isSplit);
    } else if (cmd.svgChar === 'Q') {
      return DrawCommand.quadTo(bez.start, bez.cp1, bez.end, isSplit);
    } else if (cmd.svgChar === 'C') {
      return DrawCommand.cubicTo(bez.start, bez.cp1, bez.cp2, bez.end, isSplit);
    } else {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
  }

  get commands() {
    return this.splitCommands.length ? this.splitCommands : [this.sourceCommand];
  }
}
