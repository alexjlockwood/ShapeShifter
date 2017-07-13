import { Projection, SvgChar } from 'app/model/paths';
import { CommandBuilder } from 'app/model/paths/Command';
import { MathUtil, Point } from 'app/scripts/common';

import { BBox, Calculator, Line } from '.';

export class PointCalculator implements Calculator {
  private readonly svgChar: SvgChar;
  private readonly point: Point;

  constructor(private readonly id: string, svgChar: SvgChar, point: Point) {
    this.svgChar = svgChar;
    this.point = point;
  }

  getPathLength() {
    return 0;
  }

  getPointAtLength(distance: number) {
    return this.point;
  }

  project(point: Point) {
    const x = this.point.x;
    const y = this.point.y;
    const t = 0.5;
    const d = MathUtil.distance(this.point, point);
    return { x, y, t, d } as Projection;
  }

  split(t1: number, t2: number) {
    return new PointCalculator(this.id, this.svgChar, this.point);
  }

  convert(svgChar: SvgChar) {
    return new PointCalculator(this.id, svgChar, this.point);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand() {
    let points;
    switch (this.svgChar) {
      case 'L':
      case 'Z':
        points = [this.point, this.point];
        break;
      case 'Q':
        points = [this.point, this.point, this.point];
        break;
      case 'C':
        points = [this.point, this.point, this.point, this.point];
        break;
      default:
        throw new Error('Invalid command type: ' + this.svgChar);
    }
    return new CommandBuilder(this.svgChar, points).setId(this.id).build();
  }

  getBoundingBox() {
    const x = { min: this.point.x, max: this.point.x };
    const y = { min: this.point.y, max: this.point.y };
    return { x, y } as BBox;
  }

  intersects(line: Line): number[] {
    return [];
  }
}
