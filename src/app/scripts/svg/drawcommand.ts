import * as _ from 'lodash';
import { Point, Matrix, MathUtil } from '../common';
import { IDrawCommand } from '../model';
import * as SvgUtil from './svgutil';

export abstract class DrawCommand implements IDrawCommand {
  private id_: string;
  private readonly svgChar_: string;
  private readonly points_: Point[];

  // TODO(alockwood): storing this state in here is hacky
  private onDeleteClickListener_: () => void;

  protected constructor(svgChar: string, ...points: Point[]) {
    this.svgChar_ = svgChar;
    this.points_ = points;
  }

  // Overrides ICommand interface.
  set id(id: string) { this.id_ = id; }

  // Overrides ICommand interface.
  get id() { return this.id_; }

  // Overrides IDrawCommand interface.
  get svgChar() { return this.svgChar_; }

  // Overrides IDrawCommand interface.
  get points() { return this.points_; }

  get start() { return this.points_[0]; }

  get end() { return _.last(this.points_); }

  get isModfiable() {
    return !!this.onDeleteClickListener_;
  }

  set onDeleteCommandClick(func: () => void) {
    this.onDeleteClickListener_ = func;
  }

  delete() {
    this.onDeleteClickListener_();
  }

  transform(matrices: Matrix[]) {
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i]) {
        this.points[i] = MathUtil.transform(this.points[i], ...matrices);
      }
    }
  }
}

export class MoveCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('M', start, end);
  }
}

export class LineCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('L', start, end);
  }
}

export class QuadraticCurveCommand extends DrawCommand {
  constructor(start: Point, cp: Point, end: Point) {
    super('Q', start, cp, end);
  }
}

export class BezierCurveCommand extends DrawCommand {
  constructor(start: Point, cp1: Point, cp2: Point, end: Point) {
    super('C', start, cp1, cp2, end);
  }
}

export class ClosePathCommand extends DrawCommand {
  constructor(start: Point, end: Point) {
    super('Z', start, end);
  }
}

export class EllipticalArcCommand extends DrawCommand {
  readonly args: number[];

  constructor(...args: number[]) {
    super('A', new Point(args[0], args[1]), new Point(args[7], args[8]));
    this.args = args;
  }

  transform(matrices: Matrix[]) {
    const start = MathUtil.transform({ x: this.args[0], y: this.args[1] }, ...matrices);
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
    }, matrices);
    this.args[2] = arc.rx;
    this.args[3] = arc.ry;
    this.args[4] = arc.xAxisRotation;
    this.args[5] = arc.largeArcFlag;
    this.args[6] = arc.sweepFlag;
    this.args[7] = arc.endX;
    this.args[8] = arc.endY;
  }
}
