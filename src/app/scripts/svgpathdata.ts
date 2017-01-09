import { Bezier, Projection, Split } from './bezierutil';
import { Point, Matrix, Rect } from './mathutil';
import {
  DrawCommand, MoveCommand, LineCommand, QuadraticCurveCommand,
  BezierCurveCommand, EllipticalArcCommand, ClosePathCommand, SubPathCommand, PathCommand
} from './svgcommands';
import * as SvgUtil from './svgutil';
import * as PathParser from './pathparser';

export class SvgPathData extends PathCommand {
  private pathString_: string = '';
  private length_ = 0;
  private bounds_: Rect = null;
  private commandWrappers_: CommandWrapper[];

  constructor();
  constructor(obj: string);
  constructor(obj: SvgPathData);
  constructor(obj?: any) {
    super();
    if (obj) {
      if (typeof obj === 'string') {
        this.pathString = obj;
      } else if (obj instanceof SvgPathData) {
        this.pathString = obj.pathString;
      }
    }
  }

  get pathString() {
    return this.pathString_;
  }

  set pathString(path: string) {
    this.pathString_ = path;
    this.commands_ = PathParser.parseCommands(path);
    this.updatePathCommand(false);
  }

  get commands() {
    return this.commands_;
  }

  set commands(commands: SubPathCommand[]) {
    this.commands_ = commands;
    this.updatePathCommand(true);
  }

  private updatePathCommand(shouldUpdatePathString: boolean) {
    if (shouldUpdatePathString) {
      this.pathString_ = PathParser.commandsToString(this.commands);
    }
    const {length, bounds, commandWrappers} = this.computeCommandProperties();
    this.length_ = length;
    this.bounds_ = bounds;
    this.commandWrappers_ = commandWrappers;
  }

  interpolate(start: PathCommand, end: PathCommand, fraction: number) {
    if (super.interpolate(start, end, fraction)) {
      // TODO(alockwood): avoid doing these hacks
      this.commands = this.commands;
      return true;
    }
    return false;
  }

  transform(transforms: Matrix[]) {
    super.transform(transforms);
    // TODO(alockwood): only recalculate bounds and length when necessary
    this.commands = this.commands;
  }

  reverse() {
    this.commands.forEach(c => c.reverse());
    this.commands = this.commands;
  }

  shiftBack() {
    this.commands.forEach(c => c.shiftBack());
    this.commands = this.commands;
  }

  shiftForward() {
    this.commands.forEach(c => c.shiftForward());
    this.commands = this.commands;
  }

  get length() {
    return this.length_;
  }

  toString() {
    return this.pathString;
  }

  project(point: Point): ProjectionInfo | null {
    if (!this.commands.length) {
      return null;
    }
    return this.commandWrappers_.map(cw => {
      return {
        subPathCommandIndex: cw.subPathCommandIndex,
        commandIndex: cw.drawCommandIndex,
        projection: cw.project(point),
      };
    }).filter(i => !!i.projection)
      .reduce((prev, curr) => {
        return prev && prev.projection.d < curr.projection.d ? prev : curr;
      }, null);
  }

  split(subPathCommandIndex: number, commandIndex: number, t: number) {
    let commandWrapper;
    for (let i = 0; i < this.commandWrappers_.length; i++) {
      const cw = this.commandWrappers_[i];
      if (cw.subPathCommandIndex === subPathCommandIndex
        && cw.drawCommandIndex === commandIndex) {
        commandWrapper = cw;
        break;
      }
    }

    const {left, right} = commandWrapper.split(t);
    const cmd = commandWrapper.command;
    let leftCmd: DrawCommand;
    let rightCmd: DrawCommand;
    if (cmd instanceof LineCommand) {
      leftCmd = new LineCommand(left.start, left.end);
      rightCmd = new LineCommand(right.start, right.end);
    } else if (cmd instanceof ClosePathCommand) {
      leftCmd = new LineCommand(left.start, left.end);
      rightCmd = new ClosePathCommand(right.start, right.end);
    } else if (cmd instanceof QuadraticCurveCommand) {
      leftCmd = new QuadraticCurveCommand(left.start, left.cp1, left.end);
      rightCmd = new QuadraticCurveCommand(right.start, right.cp1, right.end);
    } else if (cmd instanceof BezierCurveCommand) {
      leftCmd = new BezierCurveCommand(left.start, left.cp1, left.cp2, left.end);
      rightCmd = new BezierCurveCommand(right.start, right.cp1, right.cp2, right.end);
    } else if (cmd instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split for ellpitical arcs');
    }
    const commands: DrawCommand[] = this.commands[subPathCommandIndex].commands;
    commands.splice(commandIndex, 1, leftCmd, rightCmd);
    this.commands = this.commands;
  }

  private computeCommandProperties() {
    let length = 0;
    const bounds = new Rect(Infinity, Infinity, -Infinity, -Infinity);

    const expandBounds_ = (x: number, y: number) => {
      bounds.l = Math.min(x, bounds.l);
      bounds.t = Math.min(y, bounds.t);
      bounds.r = Math.max(x, bounds.r);
      bounds.b = Math.max(y, bounds.b);
    };

    const expandBoundsToBezier_ = (bez: Bezier) => {
      const bbox = bez.bbox();
      expandBounds_(bbox.x.min, bbox.y.min);
      expandBounds_(bbox.x.max, bbox.y.min);
      expandBounds_(bbox.x.min, bbox.y.max);
      expandBounds_(bbox.x.max, bbox.y.max);
    };

    let firstPoint = null;
    let currentPoint = new Point(0, 0);

    const commandWrappers = [];
    this.commands.forEach((subPathCommand, subPathCmdIndex) => {
      subPathCommand.commands.forEach((command, drawCmdIndex) => {
        if (command instanceof MoveCommand) {
          const nextPoint = command.points[1];
          if (!firstPoint) {
            firstPoint = nextPoint;
          }
          currentPoint = nextPoint;
          expandBounds_(nextPoint.x, nextPoint.y);
          commandWrappers.push(new CommandWrapper(this, subPathCmdIndex, drawCmdIndex));
        } else if (command instanceof LineCommand) {
          const nextPoint = command.points[1];
          length += nextPoint.distanceTo(currentPoint);
          commandWrappers.push(new CommandWrapper(
            this, subPathCmdIndex, drawCmdIndex,
            new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
          currentPoint = nextPoint;
          expandBounds_(nextPoint.x, nextPoint.y);
        } else if (command instanceof ClosePathCommand) {
          if (firstPoint) {
            length += firstPoint.distanceTo(currentPoint);
            commandWrappers.push(new CommandWrapper(
              this, subPathCmdIndex, drawCmdIndex,
              new Bezier(currentPoint, currentPoint, firstPoint, firstPoint)));
          }
          firstPoint = null;
        } else if (command instanceof BezierCurveCommand) {
          const points = command.points;
          const bez = new Bezier(currentPoint, points[1], points[2], points[3]);
          commandWrappers.push(new CommandWrapper(this, subPathCmdIndex, drawCmdIndex, bez));
          length += bez.length();
          currentPoint = points[3];
          expandBoundsToBezier_(bez);
        } else if (command instanceof QuadraticCurveCommand) {
          const points = command.points;
          const bez = new Bezier(currentPoint, points[1], points[2]);
          commandWrappers.push(new CommandWrapper(this, subPathCmdIndex, drawCmdIndex, bez));
          length += bez.length();
          currentPoint = points[2];
          expandBoundsToBezier_(bez);
        } else if (command instanceof EllipticalArcCommand) {
          const args = command.args;
          const [currentPointX, currentPointY,
            rx, ry, xAxisRotation,
            largeArcFlag, sweepFlag,
            tempPoint1X, tempPoint1Y] = args;

          if (currentPointX === tempPoint1X && currentPointY === tempPoint1Y) {
            // degenerate to point (0 length)
            commandWrappers.push(new CommandWrapper(this, subPathCmdIndex, drawCmdIndex));
            return;
          }

          if (rx === 0 || ry === 0) {
            // degenerate to line
            const nextPoint = new Point(tempPoint1X, tempPoint1Y);
            length += new Point(currentPointX, currentPointY).distanceTo(nextPoint);
            expandBounds_(tempPoint1X, tempPoint1Y);
            commandWrappers.push(new CommandWrapper(
              this, subPathCmdIndex, drawCmdIndex,
              new Bezier(currentPoint, currentPoint, nextPoint, nextPoint)));
            currentPoint = nextPoint;
            return;
          }

          const bezierCoords = SvgUtil.arcToBeziers(
            currentPointX, currentPointY,
            rx, ry, xAxisRotation,
            largeArcFlag, sweepFlag,
            tempPoint1X, tempPoint1Y);

          const arcBeziers: Bezier[] = [];
          for (let i = 0; i < bezierCoords.length; i += 8) {
            const bez = new Bezier(
              { x: currentPoint.x, y: currentPoint.y },
              { x: bezierCoords[i + 2], y: bezierCoords[i + 3] },
              { x: bezierCoords[i + 4], y: bezierCoords[i + 5] },
              { x: bezierCoords[i + 6], y: bezierCoords[i + 7] });
            arcBeziers.push(bez);
            length += bez.length();
            currentPoint = new Point(bezierCoords[i + 6], bezierCoords[i + 7]);
            expandBoundsToBezier_(bez);
          }
          commandWrappers.push(new CommandWrapper(this, subPathCmdIndex, drawCmdIndex, ...arcBeziers));
          currentPoint = new Point(tempPoint1X, tempPoint1Y);
        }
      });
    });

    return { length, bounds, commandWrappers };
  }
}

/** Wraps around the bezier curves associated with a draw command. */
class CommandWrapper {
  readonly beziers: Bezier[];

  constructor(
    public readonly pathCommand: PathCommand,
    public readonly subPathCommandIndex: number,
    public readonly drawCommandIndex: number,
    ...beziers: Bezier[]) {
    this.beziers = beziers;
  }

  project(point: Point): Projection | null {
    if (!this.beziers.length) {
      return null;
    }
    return this.beziers
      .map(bez => bez.project(point))
      .reduce((prev, curr) => prev.d < curr.d ? prev : curr);
  }

  split(t: number): Split | null {
    if (!this.beziers.length) {
      return null;
    }
    if (this.command instanceof EllipticalArcCommand) {
      throw new Error('TODO: implement split support for elliptical arcs');
    }
    return this.beziers[0].split(t);
  }

  get command() {
    return this.pathCommand
      .commands[this.subPathCommandIndex]
      .commands[this.drawCommandIndex];
  }
}

export type ProjectionInfo = {
  subPathCommandIndex: number;
  commandIndex: number;
  projection: Projection;
};
