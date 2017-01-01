import { Point, Matrix } from './mathutil';
import * as SvgUtil from './svgutil';


// TODO(alockwood): avoid the defensive point copying if possible
export abstract class Command {
  protected points_: Point[];

  protected constructor(...points_: Point[]) {
    this.points_ = points_.map(p => Point.from(p));
  }

  get points(): Point[] {
    return this.points_.map(p => Point.from(p));
  }

  abstract execute(ctx: CanvasRenderingContext2D): void;

  abstract interpolate<T extends Command>(target: T, fraction: number): T;

  abstract transform(transforms: Matrix[]): void;

  abstract toSvgChar();
}

export abstract class SimpleCommand extends Command {
  protected constructor(...points_: Point[]) {
    super(...points_);
  }

  protected static interpolatePoints(start: SimpleCommand, end: SimpleCommand, fraction: number): Point[] {
    const interpolatedPoints = [];
    for (let i = 0; i < start.points_.length; i++) {
      const startPoint = start.points_[i];
      const endPoint = end.points_[i];
      const x = startPoint.x + (endPoint.x - startPoint.x) * fraction;
      const y = startPoint.y + (endPoint.y - startPoint.y) * fraction;
      interpolatedPoints.push(new Point(x, y));
    }
    return interpolatedPoints;
  }

  transform(transforms: Matrix[]) {
    for (let i = 0; i < this.points_.length; i++) {
      this.points_[i] = this.points_[i].transform(...transforms);
    }
  }
}

export class MoveCommand extends SimpleCommand {
  constructor(start: Point, end: Point) {
    super(start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.points_[1].x, this.points_[1].y);
  }

  interpolate(target: MoveCommand, fraction: number): MoveCommand {
    const pts = SimpleCommand.interpolatePoints(this, target, fraction);
    return new MoveCommand(pts[0], pts[1]);
  }

  toSvgChar() {
    return 'M';
  }
}

export class LineCommand extends SimpleCommand {
  constructor(start: Point, end: Point) {
    super(start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.points_[1].x, this.points_[1].y);
  }

  interpolate(target: LineCommand, fraction: number): LineCommand {
    const pts = SimpleCommand.interpolatePoints(this, target, fraction);
    return new LineCommand(pts[0], pts[1]);
  }

  toSvgChar() {
    return 'L';
  }
}

export class QuadraticCurveCommand extends SimpleCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super(start, cp, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.quadraticCurveTo(
      this.points_[1].x, this.points_[1].y,
      this.points_[2].x, this.points_[2].y);
  }

  interpolate(target: QuadraticCurveCommand, fraction: number): QuadraticCurveCommand {
    const points = SimpleCommand.interpolatePoints(this, target, fraction);
    return new QuadraticCurveCommand(points[0], points[1], points[2]);
  }

  toSvgChar() {
    return 'Q';
  }
}

export class BezierCurveCommand extends SimpleCommand {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super(start, cp1, cp2, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.bezierCurveTo(
      this.points_[1].x, this.points_[1].y,
      this.points_[2].x, this.points_[2].y,
      this.points_[3].x, this.points_[3].y);
  }

  interpolate(target: BezierCurveCommand, fraction: number): BezierCurveCommand {
    const pts = SimpleCommand.interpolatePoints(this, target, fraction);
    return new BezierCurveCommand(pts[0], pts[1], pts[2], pts[3]);
  }

  toSvgChar() {
    return 'C';
  }
}

export class ClosePathCommand extends SimpleCommand {
  constructor() {
    super();
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.closePath();
  }

  interpolate(target: ClosePathCommand, fraction: number): ClosePathCommand {
    return this;
  }

  toSvgChar() {
    return 'Z';
  }
}

// TODO(alockwood): figure out what to do with elliptical arcs
export class EllipticalArcCommand extends Command {
  args: number[];

  constructor(...args: number[]) {
    super();
    this.args = args;
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }

  // TODO(alockwood): implement this?
  interpolate(target: EllipticalArcCommand, fraction: number): EllipticalArcCommand {
    return this;
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

  get points(): Point[] {
    return [new Point(this.args[0], this.args[1]), new Point(this.args[7], this.args[8])];
  }

  toSvgChar() {
    return 'A';
  }
}
