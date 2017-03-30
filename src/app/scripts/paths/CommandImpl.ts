import * as _ from 'lodash';
import { Point, Matrix, MathUtil } from '../common';
import { Command, SvgChar } from '.';
import { environment } from '../../../environments/environment';

export function newCommand(svgChar: SvgChar, points: ReadonlyArray<Point>) {
  return new CommandImpl(svgChar, points);
}

/**
 * Implementation of the Command interface. Each draw command represents
 * a single SVG drawing command (move, line, quadratic curve, bezier curve,
 * or close path).
 */
class CommandImpl implements Command {
  private readonly debugString: string;

  constructor(
    private readonly svgChar: SvgChar,
    private readonly points: ReadonlyArray<Point>,
    private readonly isSplit_ = false,
    private readonly id = _.uniqueId(),
  ) {
    if (svgChar === undefined) {
      throw new Error('Attempt to set an undefined svgChar');
    }
    this.debugString = environment.production ? '' : this.toString();
  }

  // Implements the Command interface.
  getId() {
    return this.id;
  }

  // Implements the Command interface.
  getSvgChar() {
    return this.svgChar;
  }

  // Implements the Command interface.
  getPoints() {
    return this.points;
  }

  isSplit() {
    return this.isSplit_;
  }

  // Implements the Command interface.
  getStart() {
    return _.first(this.points);
  }

  // Implements the Command interface.
  getEnd() {
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
        const uniquePoints =
          _.uniqWith(this.points, (p1: Point, p2: Point) => p1.equals(p2));
        return ch === 'C' || ch === 'L' && uniquePoints.length <= 2;
      }
      case 'C': {
        const uniquePoints =
          _.uniqWith(this.points, (p1: Point, p2: Point) => p1.equals(p2));
        return ch === 'L' && uniquePoints.length <= 2;
      }
    }
    return false;
  }

  // Implements the Command interface.
  mutate() {
    return new CommandBuilder(
      this.svgChar,
      this.points.slice(),
      this.isSplit(),
      this.id,
    );
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

export class CommandBuilder {
  private transforms: Matrix[] = [];

  constructor(
    private svgChar: SvgChar,
    private points: Point[],
    private isSplit = false,
    private id = '',
  ) { }

  setSvgChar(svgChar: SvgChar) {
    this.svgChar = svgChar;
    return this;
  }

  setId(id: string) {
    this.id = id;
    return this;
  }

  setPoints(...points: Point[]) {
    this.points = points;
    return this;
  }

  toggleSplit() {
    this.isSplit = !this.isSplit;
    return this;
  }

  transform(transforms: Matrix[]) {
    this.transforms = [].concat(transforms, this.transforms);
    return this;
  }

  reverse() {
    if (this.svgChar !== 'M' || this.points[0]) {
      // The first move command of an SVG path has an undefined
      // starting point, so no change is required in that case.
      this.points.reverse();
    }
    return this;
  }

  build() {
    return new CommandImpl(
      this.svgChar,
      this.points.map(p => p ? MathUtil.transformPoint(p, ...this.transforms) : p),
      this.isSplit,
      this.id || _.uniqueId(),
    );
  }
}
