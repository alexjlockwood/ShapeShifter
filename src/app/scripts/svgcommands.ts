import { Point, Matrix } from './mathutil';
import * as SvgUtil from './svgutil';

export interface Command {

  svgChar: string;

  points: Point[];

  startPoint: Point;

  endPoint: Point;

  interpolate<T extends Command>(start: T, end: T, fraction: number);

  transform(transforms: Matrix[]);

  reverse();
}

export abstract class CommandImpl implements Command {
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

  get startPoint() {
    return this.points_[0];
  }

  get endPoint() {
    return this.points_[this.points_.length - 1];
  }

  interpolate<T extends Command>(start: T, end: T, fraction: number) {
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

  reverse() {
    if (this.startPoint) {
      // Only reverse the command if it has a valid start point (i.e. if it isn't
      // the first move command in the path).
      this.points.reverse();
    }
  }
}

export class MoveCommand extends CommandImpl {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }
}

export class LineCommand extends CommandImpl {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }
}

export class QuadraticCurveCommand extends CommandImpl {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }
}

export class BezierCurveCommand extends CommandImpl {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super('C', start, cp1, cp2, end);
  }
}

export class ClosePathCommand extends CommandImpl {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }
}

// TODO(alockwood): figure out what to do with elliptical arcs
export class EllipticalArcCommand extends CommandImpl {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
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
