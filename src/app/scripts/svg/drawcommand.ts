import * as _ from 'lodash';
import { Point, Matrix, MathUtil } from '../common';
import { DrawCommand } from '../model';
import * as SvgUtil from './svgutil';

export type SvgChar = 'M' | 'L' | 'Q' | 'C' | 'A' | 'Z';

/**
 * Implementation of the IDrawCommand interface. Each draw command represents
 * a single SVG drawing command (move, line, quadratic curve, bezier curve,
 * elliptical arc, or close path).
 */
export class DrawCommandImpl implements DrawCommand {

  private readonly points_: ReadonlyArray<Point>;
  private readonly args_: ReadonlyArray<number>;

  static moveTo(start: Point, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('M', !!isSplit, [start, end]);
  }

  static lineTo(start: Point, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('L', !!isSplit, [start, end]);
  }

  static quadTo(start: Point, cp: Point, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('Q', !!isSplit, [start, cp, end]);
  }

  static cubicTo(start: Point, cp1: Point, cp2: Point, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('C', !!isSplit, [start, cp1, cp2, end]);
  }

  static arcTo(start: Point, rx: number, ry: number, xAxisRotation: number,
    largeArcFlag: number, sweepFlag: number, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('A', !!isSplit, [start, end],
      start.x, start.y, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, end.x, end.y);
  }

  static closePath(start: Point, end: Point, isSplit?: boolean) {
    return new DrawCommandImpl('Z', isSplit, [start, end]);
  }

  constructor(
    private readonly svgChar_: SvgChar,
    private readonly isSplit_: boolean,
    points: Point[],
    ...args: number[]) {
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

  // Overrides IDrawCommand interface.
  get args(): ReadonlyArray<number> { return this.args_; }

  /** Returns the command's starting point. */
  get start() { return this.points[0]; }

  /** Returns the command's ending point. */
  get end() { return _.last(this.points); }

  get isSplit() {
    return this.isSplit_;
  }

  /** Returns a new transformed draw command. */
  transform(matrices: Matrix[]): DrawCommandImpl {
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
      return new DrawCommandImpl('A', this.isSplit, [start, new Point(arc.endX, arc.endY)],
        start.x, start.y,
        arc.rx, arc.ry,
        arc.xAxisRotation, arc.largeArcFlag, arc.sweepFlag,
        arc.endX, arc.endY);
    } else {
      return new DrawCommandImpl(this.svgChar, this.isSplit, this.points.map(p => {
        return p ? MathUtil.transform(p, ...matrices) : p;
      }));
    }
  }

  /** Returns a new reversed draw command. */
  reverse(): DrawCommandImpl {
    let points = this.points.slice();
    let args = this.args.slice();
    if (this.svgChar === 'A') {
      points.reverse();
      const endX = args[0];
      const endY = args[1];
      args[0] = args[7];
      args[1] = args[8];
      args[6] = args[6] === 0 ? 1 : 0;
      args[7] = endX;
      args[8] = endY;
    } else if (this.svgChar !== 'M' || this.start) {
      // The first move command of an SVG path has an undefined
      // starting point, so no change is required in that case.
      points = points.reverse();
      args = pointsToArgs(points);
    }
    return new DrawCommandImpl(this.svgChar, this.isSplit, points, ...args);
  }

  toString() {
    if (this.svgChar === 'Z') {
      return `${this.svgChar}`;
    } else {
      const p = _.last(this.points);
      const x = Number(p.x.toFixed(3)).toString();
      const y = Number(p.y.toFixed(3)).toString();
      return `${this.svgChar} ${x}, ${y}`;
    }
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
