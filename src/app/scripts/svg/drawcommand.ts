import * as _ from 'lodash';
import { Point, Matrix, MathUtil } from '../common';
import { IDrawCommand } from '../model';
import * as SvgUtil from './svgutil';

export class DrawCommand implements IDrawCommand {

  static moveTo(start: Point, end: Point) {
    return new DrawCommand('M', [start, end]);
  }

  static lineTo(start: Point, end: Point) {
    return new DrawCommand('L', [start, end]);

  }

  static quadTo(start: Point, cp: Point, end: Point) {
    return new DrawCommand('Q', [start, cp, end]);
  }

  static cubicTo(start: Point, cp1: Point, cp2: Point, end: Point) {
    return new DrawCommand('C', [start, cp1, cp2, end]);
  }

  static arcTo(start: Point, rx: number, ry: number, xAxisRotation: number,
    largeArcFlag: number, sweepFlag: number, end: Point) {
    return new DrawCommand('A', [start, end],
      start.x, start.y, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, end.x, end.y);
  }

  static closePath(start: Point, end: Point) {
    return new DrawCommand('Z', [start, end]);
  }

  private readonly svgChar_: string;
  private readonly points_: ReadonlyArray<Point>;
  private readonly args_: ReadonlyArray<number>;

  // TODO(alockwood): storing this state in here is hacky
  private onDeleteClickListener_: () => void;

  private constructor(svgChar: string, points: Point[], ...args: number[]) {
    this.svgChar_ = svgChar;
    this.points_ = points.slice();
    if (args) {
      this.args_ = args;
    } else {
      this.args_ = pointsToArgs(points);
    }
  }

  // Overrides IDrawCommand interface.
  get svgChar() { return this.svgChar_; }

  // Overrides IDrawCommand interface.
  get points(): ReadonlyArray<Point> { return this.points_; }

  /** Returns the raw number arguments for this draw command. */
  get args(): ReadonlyArray<number> { return this.args_; }

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

  transform(matrices: Matrix[]): DrawCommand {
    if (this.svgChar === 'A') {
      const start = MathUtil.transform(this.start, ...matrices);
      const arc = SvgUtil.transformArc({
        rx: this.args[2],
        ry: this.args[3],
        xAxisRotation: this.args[4],
        largeArcFlag: this.args[5],
        sweepFlag: this.args[6],
        endX: this.args[7],
        endY: this.args[8],
      }, matrices);
      return new DrawCommand('A', [start, new Point(arc.endX, arc.endY)],
        start.x, start.y,
        arc.rx, arc.ry,
        arc.xAxisRotation, arc.largeArcFlag, arc.sweepFlag,
        arc.endX, arc.endY);
    } else {
      return new DrawCommand(this.svgChar, this.points.map(p => {
        return p ? MathUtil.transform(p, ...matrices) : p;
      }));
    }
  }

  reverse(): DrawCommand {
    let points = this.points.slice();
    let args;
    if (this.svgChar === 'A') {
      points.reverse();
      args = this.args.slice();
      const endX = args[0];
      const endY = args[1];
      args[0] = args[7];
      args[1] = args[8];
      args[6] = args[6] === 0 ? 1 : 0;
      args[7] = endX;
      args[8] = endY;
    } else if (!(this.svgChar === 'M' || this.start)) {
      points.reverse();
      args = pointsToArgs(points);
    } else {
      args = pointsToArgs(points);
    }
    return new DrawCommand(this.svgChar, points, ...args);
  }
}

function pointsToArgs(points: Point[]): number[] {
  const args = [];
  points.forEach(p => {
    args.push(p.x);
    args.push(p.y);
  });
  return args;
}
