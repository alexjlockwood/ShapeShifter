import * as _ from 'lodash';
import { Point, Matrix, MathUtil } from '../common';
import { Command, SvgChar } from '.';

export function newMove(start: Point, end: Point) {
  return new CommandImpl('M', [start, end]);
}

export function newLine(start: Point, end: Point) {
  return new CommandImpl('L', [start, end]);
}

export function newQuadraticCurve(start: Point, cp: Point, end: Point) {
  return new CommandImpl('Q', [start, cp, end]);
}

export function newBezierCurve(
  start: Point, cp1: Point, cp2: Point, end: Point) {
  return new CommandImpl('C', [start, cp1, cp2, end]);
}

export function newClosePath(start: Point, end: Point) {
  return new CommandImpl('Z', [start, end]);
}

/**
 * Implementation of the Command interface. Each draw command represents
 * a single SVG drawing command (move, line, quadratic curve, bezier curve,
 * elliptical arc, or close path).
 */
export class CommandImpl implements Command {

  constructor(
    public readonly svgChar: SvgChar,
    public readonly points: ReadonlyArray<Point>,
    public readonly isSplit = false) { }

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
    if (this.svgChar === 'M' || ch === 'M' || this.svgChar === ch) {
      return false;
    }
    switch (this.svgChar) {
      case 'L':
        return ch === 'Q' || ch === 'C';
      case 'Z':
        return ch === 'L' || ch === 'Q' || ch === 'C';
      case 'Q': {
        const uniquePoints = _.uniqWith(this.points, (p1, p2) => p1.equals(p2));
        return ch === 'C' || ch === 'L' && uniquePoints.length <= 2;
      }
      case 'C': {
        const uniquePoints = _.uniqWith(this.points, (p1, p2) => p1.equals(p2));
        return ch === 'L' && uniquePoints.length <= 2;
      }
    }
    return false;
  }

  // Implements the Command interface.
  transform(matrices: Matrix[]): Command {
    return new CommandImpl(
      this.svgChar,
      this.points.map(p => p ? MathUtil.transformPoint(p, ...matrices) : p),
      this.isSplit);
  }

  /** Returns a new reversed draw command. */
  reverse(): CommandImpl {
    if (this.svgChar !== 'M' || this.start) {
      const points = this.points.slice().reverse();
      return new CommandImpl(this.svgChar, points, this.isSplit);
    }
    // The first move command of an SVG path has an undefined
    // starting point, so no change is required in that case.
    return this;
  }

  /** Returns a new draw command object with its split property toggled. */
  toggleSplit() {
    return new CommandImpl(this.svgChar, this.points, !this.isSplit);
  }

  toString() {
    if (this.svgChar === 'Z') {
      return `${this.svgChar}`;
    } else {
      const p = _.last(this.points);
      const x = _.round(p.x, 3);
      const y = _.round(p.y, 3);
      return `${this.svgChar} ${x}, ${y}`;
    }
  }
}
