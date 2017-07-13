import { Projection, SvgChar } from 'app/model/paths';
import { CommandBuilder } from 'app/model/paths/Command';
import { Point } from 'app/scripts/common';

import { BBox, Calculator, Line } from '.';

export class MoveCalculator implements Calculator {
  constructor(
    private readonly id: string,
    private readonly startPoint: Point | undefined,
    private readonly endPoint: Point,
  ) {}

  getPathLength() {
    return 0;
  }

  project(point: Point): Projection | undefined {
    return undefined;
  }

  getPointAtLength(distance: number): Point {
    return this.endPoint;
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
    return new CommandBuilder('M', [this.startPoint, this.endPoint]).setId(this.id).build();
  }

  getBoundingBox() {
    const x = { min: NaN, max: NaN };
    const y = { min: NaN, max: NaN };
    return { x, y } as BBox;
  }

  intersects(line: Line): number[] {
    return [];
  }
}
