import { Point, Matrix } from './mathutil';
import * as SvgUtil from './svgutil';


export abstract class Command {
  private readonly svgChar_: string;
  private readonly points_: Point[];

  protected constructor(svgChar: string, ...points_: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = Array.from(points_);
  }

  get svgChar() {
    return this.svgChar_;
  }

  get points() {
    return this.points_;
  }

  abstract execute(ctx: CanvasRenderingContext2D): void;

  abstract interpolate<T extends Command>(start: T, end: T, fraction: number): void;

  abstract transform(transforms: Matrix[]): void;

  //abstract reverse(): void;
}

export abstract class SimpleCommand extends Command {
  protected constructor(svgChar: string, ...points_: Point[]) {
    super(svgChar, ...points_);
  }

  interpolate<T extends SimpleCommand>(start: T, end: T, fraction: number) {
    for (let i = 0; i < start.points.length; i++) {
      const startPoint = start.points[i];
      const endPoint = end.points[i];
      const x = startPoint.x + (endPoint.x - startPoint.x) * fraction;
      const y = startPoint.y + (endPoint.y - startPoint.y) * fraction;
      this.points[i] = new Point(x, y);
    }
  }

  transform(transforms: Matrix[]) {
    for (let i = 0; i < this.points.length; i++) {
      this.points[i] = this.points[i].transform(...transforms);
    }
  }
}

export class MoveCommand extends SimpleCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.points[1].x, this.points[1].y);
  }
}

export class LineCommand extends SimpleCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.points[1].x, this.points[1].y);
  }
}

export class QuadraticCurveCommand extends SimpleCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.quadraticCurveTo(
      this.points[1].x, this.points[1].y,
      this.points[2].x, this.points[2].y);
  }
}

export class BezierCurveCommand extends SimpleCommand {
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

export class ClosePathCommand extends SimpleCommand {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.closePath();
  }
}

// TODO(alockwood): figure out what to do with elliptical arcs
export class EllipticalArcCommand extends Command {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }

  // TODO(alockwood): implement this somehow?
  interpolate(start: EllipticalArcCommand, end: EllipticalArcCommand, fraction: number) { }

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
}
