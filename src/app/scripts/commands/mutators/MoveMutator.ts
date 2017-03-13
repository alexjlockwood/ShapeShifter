import { Mutator, BBox, Line } from '.';
import { SvgChar, ProjectionResult, newMove } from '..';
import { MathUtil, Point } from '../../common';

export class MoveMutator implements Mutator {
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

  split(t1: number, t2: number): Mutator {
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
