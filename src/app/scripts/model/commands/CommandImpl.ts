import * as _ from 'lodash';
import { Point, Matrix, MathUtil, SvgUtil } from '../../common';
import { Command, SvgChar } from '.';

/**
 * Implementation of the Command interface. Each draw command represents
 * a single SVG drawing command (move, line, quadratic curve, bezier curve,
 * elliptical arc, or close path).
 */
export class CommandImpl implements Command {
  readonly points: ReadonlyArray<Point>;
  readonly args: ReadonlyArray<number>;
  readonly commandString: string;

  constructor(
    public readonly svgChar: SvgChar,
    public readonly isSplit: boolean,
    points: ReadonlyArray<Point>,
    ...args: number[]) {
    this.points = points.slice();

    if (args) {
      this.args = args;
    } else {
      this.args = pointsToArgs(points);
    }

    if (this.svgChar === 'Z') {
      this.commandString = `${this.svgChar}`;
    } else {
      const p = _.last(this.points);
      const x = _.round(p.x, 3);
      const y = _.round(p.y, 3);
      this.commandString = `${this.svgChar} ${x}, ${y}`;
    }
  }

  // Implements the Command interface.
  get start() {
    return _.first(this.points);
  }

  // Implements the Command interface.
  get end() {
    return _.last(this.points);
  }

  // Implements the Command interface.
  canConvertTo(targetChar: SvgChar) {
    const ch = targetChar;
    if (this.svgChar === 'M' || ch === 'M') {
      return false;
    }
    if (this.svgChar === ch) {
      return true;
    }
    switch (this.svgChar) {
      case 'L':
        // TODO: technically it should be possible to convert L to Z
        return ch === 'Q' || ch === 'C';
      case 'Z':
        return ch === 'L' || ch === 'Q' || ch === 'C';
      case 'Q':
        // TODO: possible to convert to C?
        // TODO: possible to convert to A?
        return ch === 'L' && MathUtil.areCollinear(...this.points) || ch === 'C';
      case 'C':
        // TODO: possible to convert to Q?
        // TODO: possible to convert to A?
        return ch === 'L' && MathUtil.areCollinear(...this.points);
      case 'A':
        // TODO: convert to one or more cubic bezier curves
        return ch === 'C';
    }
    return false;
  }

  // Implements the Command interface.
  transform(matrices: Matrix[]): Command {
    if (this.svgChar === 'A') {
      const start = MathUtil.transformPoint(this.start, ...matrices);
      const arc = SvgUtil.transformArc({
        rx: this.args[2],
        ry: this.args[3],
        xAxisRotation: this.args[4],
        largeArcFlag: this.args[5],
        sweepFlag: this.args[6],
        endX: this.args[7],
        endY: this.args[8],
      }, matrices);
      return new CommandImpl(
        'A',
        this.isSplit,
        [start, new Point(arc.endX, arc.endY)],
        start.x, start.y,
        arc.rx, arc.ry,
        arc.xAxisRotation, arc.largeArcFlag, arc.sweepFlag,
        arc.endX, arc.endY);
    } else {
      return new CommandImpl(
        this.svgChar,
        this.isSplit,
        this.points.map(p => p ? MathUtil.transformPoint(p, ...matrices) : p));
    }
  }

  /** Returns a new reversed draw command. */
  reverse(): CommandImpl {
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
    return new CommandImpl(this.svgChar, this.isSplit, points, ...args);
  }

  /** Returns a new draw command object with its split property toggled. */
  toggleSplit() {
    return new CommandImpl(this.svgChar, !this.isSplit, this.points, ...this.args);
  }

  toString() {
    return this.commandString;
  }
}

function pointsToArgs(points: ReadonlyArray<Point>): number[] {
  const args = [];
  points.forEach(p => { args.push(p.x); args.push(p.y); });
  return args;
}

export function moveTo(start: Point, end: Point, isSplit?: boolean) {
  return new CommandImpl('M', !!isSplit, [start, end]);
}

export function lineTo(start: Point, end: Point, isSplit?: boolean) {
  return new CommandImpl('L', !!isSplit, [start, end]);
}

export function quadraticCurveTo(start: Point, cp: Point, end: Point, isSplit?: boolean) {
  return new CommandImpl('Q', !!isSplit, [start, cp, end]);
}

export function bezierCurveTo(
  start: Point, cp1: Point, cp2: Point, end: Point, isSplit?: boolean) {
  return new CommandImpl('C', !!isSplit, [start, cp1, cp2, end]);
}

export function arcTo(start: Point, rx: number, ry: number, xAxisRotation: number,
  largeArcFlag: number, sweepFlag: number, end: Point, isSplit?: boolean) {
  return new CommandImpl('A', !!isSplit, [start, end],
    start.x, start.y, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, end.x, end.y);
}

export function closePath(start: Point, end: Point, isSplit?: boolean) {
  return new CommandImpl('Z', !!isSplit, [start, end]);
}
