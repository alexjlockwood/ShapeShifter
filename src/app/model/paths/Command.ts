import { MathUtil, Matrix, Point } from 'app/scripts/common';
import * as _ from 'lodash';

import { SvgChar } from '.';

/**
 * Represents an individual SVG command. These are the essential building blocks
 * of all Paths and SubPath objects.
 */
export class Command {
  constructor(
    private readonly svgChar: SvgChar,
    private readonly points: ReadonlyArray<Point>,
    private readonly isSplitPoint_ = false,
    private readonly id = _.uniqueId(),
    private readonly isSplitSegment_ = false,
  ) {
    if (svgChar === undefined) {
      throw new Error('Attempt to set an undefined svgChar');
    }
  }

  /**
   * Returns the unique ID for this command.
   */
  getId() {
    return this.id;
  }

  /**
   * Returns the SVG character for this command.
   */
  getSvgChar() {
    return this.svgChar;
  }

  /**
   * Returns the points for this command.
   */
  getPoints() {
    return this.points;
  }

  /**
   * Returns true iff the command was created as a result of being split.
   * Only split commands are able to be editted and deleted via the inspector/canvas.
   */
  isSplitPoint() {
    return this.isSplitPoint_;
  }

  /**
   * Returns true iff the command was created as a result of a subpath split.
   */
  isSplitSegment() {
    return this.isSplitSegment_;
  }

  /**
   * Returns the command's starting point.
   */
  getStart() {
    return _.first(this.points);
  }

  /**
   * Returns the command's ending point.
   */
  getEnd() {
    return _.last(this.points);
  }

  /**
   * Returns true iff this command can be converted into a new command
   * that is morphable with the specified SVG command type.
   */
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
        const uniquePoints = _.uniqWith(this.points, MathUtil.arePointsEqual);
        return ch === 'C' || (ch === 'L' && uniquePoints.length <= 2);
      }
      case 'C': {
        const uniquePoints = _.uniqWith(this.points, MathUtil.arePointsEqual);
        return ch === 'L' && uniquePoints.length <= 2;
      }
    }
    return false;
  }

  /**
   * Returns a builder to construct a mutated Command.
   */
  mutate() {
    return new CommandBuilder(
      this.svgChar,
      [...this.points],
      this.isSplitPoint(),
      this.id,
      this.isSplitSegment_,
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
  private matrix: Matrix = Matrix.identity();

  constructor(
    private svgChar: SvgChar,
    private points: Point[],
    private isSplitPoint = false,
    private id = '',
    private isSplitSegment = false,
  ) {}

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

  toggleSplitPoint() {
    return this.setIsSplitPoint(!this.isSplitPoint);
  }

  setIsSplitPoint(isSplitPoint: boolean) {
    this.isSplitPoint = isSplitPoint;
    return this;
  }

  setIsSplitSegment(isSplitSegment: boolean) {
    this.isSplitSegment = isSplitSegment;
    return this;
  }

  transform(transform: Matrix) {
    this.matrix = transform.dot(this.matrix);
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
    return new Command(
      this.svgChar,
      this.points.map(p => (p ? MathUtil.transformPoint(p, this.matrix) : p)),
      this.isSplitPoint,
      this.id || _.uniqueId(),
      this.isSplitSegment,
    );
  }
}
