import { Point, Matrix } from './mathutil';
import * as SvgUtil from './svgutil';

export interface PathCommand {
  isMorphableWith<T extends PathCommand>(start: T, end: T): boolean;
  interpolate<T extends PathCommand>(start: T, end: T, fraction: number): void;
  transform(transforms: Matrix[]): void;
  execute(ctx: CanvasRenderingContext2D): void;
}

export class SubPathCommand implements PathCommand {
  private commands_: DrawCommand[];

  constructor(...commands: DrawCommand[]) {
    if (!commands.length || !(commands[0] instanceof MoveCommand)) {
      throw new Error('SubPathCommands must begin with a valid MoveCommand');
    }
    this.commands_ = commands;
  }

  isMorphableWith(start: SubPathCommand, end: SubPathCommand) {
    if (start.commands.length !== this.commands.length
      || this.commands.length !== end.commands.length) {
      return false;
    }
    return this.commands.every((c, i) => c.isMorphableWith(start.commands[i], end.commands[i]));
  }

  interpolate(start: SubPathCommand, end: SubPathCommand, fraction: number) {
    this.commands.forEach((c, i) => this.commands[i].interpolate(start.commands[i], end.commands[i], fraction));
  }

  transform(transforms: Matrix[]) {
    this.commands.forEach(c => c.transform(transforms));
  }

  execute(ctx: CanvasRenderingContext2D) {
    this.commands.forEach(c => c.execute(ctx));
  }

  get commands() {
    return this.commands_;
  }

  get startPoint() {
    return this.commands[0].endPoint;
  }

  get endPoint() {
    return this.commands[this.commands.length - 1].endPoint;
  }

  isClosed() {
    return this.startPoint.equals(this.endPoint);
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const firstMoveCommand = this.commands[0];
    if (this.commands.length === 1) {
      firstMoveCommand.reverse();
      return;
    }
    const cmds: DrawCommand[] = this.commands;
    const newCmds: DrawCommand[] = [
      new MoveCommand(firstMoveCommand.startPoint, cmds[cmds.length - 1].endPoint)
    ];
    for (let i = cmds.length - 1; i >= 1; i--) {
      cmds[i].reverse();
      newCmds.push(cmds[i]);
    }
    const secondCmd = newCmds[1];
    if (secondCmd instanceof ClosePathCommand) {
      newCmds[1] = new LineCommand(secondCmd.startPoint, secondCmd.endPoint);
      const lastCmd = newCmds[newCmds.length - 1];
      newCmds[newCmds.length - 1] = new ClosePathCommand(lastCmd.startPoint, lastCmd.endPoint);
    }
    this.commands_ = newCmds;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    // TODO(alockwood): make this more efficient... :P
    for (let i = 0; i < this.commands.length - 2; i++) {
      this.shiftBack();
    }
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    const newCmdLists: DrawCommand[][] = [];
    const cmds = this.commands;
    const moveStartPoint = cmds[0].startPoint;
    cmds.unshift(cmds.pop());

    if (cmds[0] instanceof ClosePathCommand) {
      const lastCmd = cmds[cmds.length - 1];
      cmds[cmds.length - 1] = new ClosePathCommand(lastCmd.startPoint, lastCmd.endPoint);
      cmds[1] = new LineCommand(cmds[0].startPoint, cmds[0].endPoint);
    } else {
      cmds[1] = cmds[0];
    }
    // TODO(alockwood): confirm that the start point is correct here for paths with multiple moves
    cmds[0] = new MoveCommand(moveStartPoint, cmds[1].startPoint);
  }

  split() {

  }
}

export abstract class DrawCommand implements PathCommand {
  private readonly svgChar_: string;
  private readonly points_: Point[];

  protected constructor(svgChar: string, ...points_: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = Array.from(points_);
  }

  isMorphableWith(start: DrawCommand, end: DrawCommand) {
    return start.constructor === this.constructor && this.constructor === end.constructor;
  }

  interpolate<T extends DrawCommand>(start: T, end: T, fraction: number) {
    for (let i = 0; i < start.points.length; i++) {
      const startPoint = start.points[i];
      const endPoint = end.points[i];
      if (startPoint && endPoint) {
        const x = startPoint.x + (endPoint.x - startPoint.x) * fraction;
        const y = startPoint.y + (endPoint.y - startPoint.y) * fraction;
        this.points[i] = new Point(x, y);
      }
    }
  }

  transform(transforms: Matrix[]) {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i]) {
        this.points[i] = this.points[i].transform(...transforms);
      }
    }
  }

  abstract execute(ctx: CanvasRenderingContext2D): void;

  get svgChar() {
    return this.svgChar_;
  }

  get points() {
    return this.points_;
  }

  get startPoint() {
    return this.points_[0];
  }

  get endPoint() {
    return this.points_[this.points_.length - 1];
  }

  reverse() {
    if (this.startPoint) {
      // Only reverse the command if it has a valid start point (i.e. if it isn't
      // the first move command in the path).
      this.points.reverse();
    }
  }
}

export class MoveCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.endPoint.x, this.endPoint.y);
  }
}

export class LineCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.endPoint.x, this.endPoint.y);
  }
}

export class QuadraticCurveCommand extends DrawCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.quadraticCurveTo(
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y);
  }
}

export class BezierCurveCommand extends DrawCommand {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super('C', start, cp1, cp2, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.bezierCurveTo(
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y,
      this.points[3].x, this.points[3].y);
  }
}

export class ClosePathCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.closePath();
  }
}

// TODO(alockwood): figure out what to do with elliptical arcs
export class EllipticalArcCommand extends DrawCommand {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }

  // TODO(alockwood): implement this somehow?
  interpolate(start: EllipticalArcCommand, end: EllipticalArcCommand, fraction: number) {
    console.warn('TODO: implement interpolate for elliptical arcs')
  }

  transform(transforms: Matrix[]) {
    const start = new Point(this.args[0], this.args[1]).transform(...transforms);
    this.args[0] = start.x;
    this.args[1] = start.y;
    const arc = SvgUtil.transformArc({
      rx: this.args[2],
      ry: this.args[3],
      xAxisRotation: this.args[4],
      largeArcFlag: this.args[5],
      sweepFlag: this.args[6],
      endX: this.args[7],
      endY: this.args[8],
    }, transforms);
    this.args[2] = arc.rx;
    this.args[3] = arc.ry;
    this.args[4] = arc.xAxisRotation;
    this.args[5] = arc.largeArcFlag;
    this.args[6] = arc.sweepFlag;
    this.args[7] = arc.endX;
    this.args[8] = arc.endY;
  }

  reverse() {
    const endX = this.args[0];
    const endY = this.args[1];
    this.args[0] = this.args[7];
    this.args[1] = this.args[8];
    this.args[6] = this.args[6] === 0 ? 1 : 0;
    this.args[7] = endX;
    this.args[8] = endY;
  }
}
