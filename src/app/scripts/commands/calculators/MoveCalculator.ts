import { Calculator, BBox, Line } from '.';
import { SvgChar, ProjectionResult, CommandBuilder } from '..';
import { Point } from '../../common';

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
    return new CommandBuilder('M', [this.startPoint, this.endPoint]).build();
  }

  getBoundingBox() {
    const x = { min: NaN, max: NaN };
    const y = { min: NaN, max: NaN };
    return { x, y } as BBox;
  }

  intersects(line: Line) {
    return [];
  }
}
