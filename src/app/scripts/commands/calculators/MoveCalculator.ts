import { Calculator, BBox, Line } from '.';
import { SvgChar, ProjectionResult, newMove } from '..';
import { MathUtil, Point } from '../../common';

export class MoveCalculator implements Calculator {
  private readonly startPoint: Point | undefined;
  private readonly endPoint: Point;

  constructor(startPoint: Point | undefined, endPoint: Point) {
    this.startPoint = startPoint;
    this.endPoint = endPoint;
  }

  getPathLength() {
    return 0;
  }

  project(point: Point): ProjectionResult | undefined {
    return undefined;
  }

  split(t1: number, t2: number): Calculator {
    return this;
  }

  convert(svgChar: SvgChar) {
    return this;
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand() {
    return newMove(this.startPoint, this.endPoint);
  }

  getBoundingBox() {
    const x = { min: Infinity, max: -Infinity };
    const y = { min: Infinity, max: -Infinity };
    return { x, y } as BBox;
  }

  intersects(line: Line) {
    return [];
  }
}
