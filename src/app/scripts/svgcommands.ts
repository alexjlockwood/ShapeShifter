import { Point, Matrix } from './mathutil';
import * as MathUtil from './mathutil';
import * as SvgUtil from './svgutil';

/**
 * Represents an individual SVG draw command.
 */
export abstract class DrawCommand {
  private readonly svgChar_: string;
  private readonly points_: Point[];
  private isModifiable_ = false;

  protected constructor(svgChar: string, ...points: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = points;
  }

  interpolate<T extends DrawCommand>(start: T, end: T, fraction: number) {
    for (let i = 0; i < start.points.length; i++) {
      const startPoint = start.points[i];
      const endPoint = end.points[i];
      if (startPoint && endPoint) {
        const x = lerp(startPoint.x, endPoint.x, fraction);
        const y = lerp(startPoint.y, endPoint.y, fraction);
        this.points[i] = new Point(x, y);
      }
    }
    return true;
  }

  abstract execute(ctx: CanvasRenderingContext2D): void;

  get svgChar() {
    return this.svgChar_;
  }

  get points() {
    return this.points_;
  }

  get start() {
    return this.points_[0];
  }

  get end() {
    return this.points_[this.points_.length - 1];
  }

  set isModifiable(isModifiable: boolean) {
    this.isModifiable_ = isModifiable;
  }

  get isModifiable() {
    return this.isModifiable_;
  }
}

export class MoveCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.moveTo(this.end.x, this.end.y);
  }
}

export class LineCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }

  execute(ctx: CanvasRenderingContext2D) {
    ctx.lineTo(this.end.x, this.end.y);
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

  // TODO(alockwood): confirm this is correct?
  interpolate(start: EllipticalArcCommand, end: EllipticalArcCommand, fraction: number) {
    this.args.forEach((_, i) => {
      if (i === 5 || i === 6) {
        // Doesn't make sense to interpolate the large arc and sweep flags.
        this.args[i] = fraction === 0 ? start.args[i] : end.args[i];
        return;
      }
      this.args[i] = lerp(start.args[i], end.args[i], fraction);
    });
    return true;
  }

  execute(ctx: CanvasRenderingContext2D) {
    SvgUtil.executeArc(ctx, this.args);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
