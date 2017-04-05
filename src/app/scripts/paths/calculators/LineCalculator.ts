import * as _ from 'lodash';
import { Calculator, BBox, Line } from '.';
import { SvgChar, Projection } from '..';
import { CommandBuilder } from '../CommandImpl';
import { MathUtil, Point } from '../../common';
import { PointCalculator } from './PointCalculator';

const ROUNDING_PRECISION = 10;

export class LineCalculator implements Calculator {

  constructor(
    private readonly id: string,
    private readonly svgChar: SvgChar,
    private readonly p1: Point,
    private readonly p2: Point,
  ) { }

  getPathLength() {
    return MathUtil.distance(this.p1, this.p2);
  }

  project({ x, y }: Point): Projection {
    const { x: x1, y: y1 } = this.p1;
    const { x: x2, y: y2 } = this.p2;
    const a = x2 - x1;
    const b = y2 - y1;
    const dot = (x - x1) * a + (y - y1) * b;
    const lenSq = round(a * a + b * b);
    const param = lenSq === 0 ? -1 : round(dot / lenSq);
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * a;
      yy = y1 + param * b;
    }
    const dx = x - xx;
    const dy = y - yy;
    const dd = Math.sqrt(dx * dx + dy * dy);
    let dt;
    const rx1 = round(x1);
    const rx2 = round(x2);
    const ry1 = round(y1);
    const ry2 = round(y2);
    if (rx2 !== rx1) {
      dt = (xx - x1) / (x2 - x1);
    } else if (ry2 !== ry1) {
      dt = (yy - y1) / (y2 - y1);
    } else {
      dt = 0.5;
    }
    return { x: round(xx), y: round(yy), d: round(dd), t: round(dt) };
  }

  split(t1: number, t2: number): Calculator {
    const { x: x1, y: y1 } = this.p1;
    const { x: x2, y: y2 } = this.p2;
    const p1 = new Point(
      MathUtil.lerp(x1, x2, t1),
      MathUtil.lerp(y1, y2, t1));
    const p2 = new Point(
      MathUtil.lerp(x1, x2, t2),
      MathUtil.lerp(y1, y2, t2));
    if (p1.equals(p2)) {
      return new PointCalculator(this.id, this.svgChar, p1);
    }
    return new LineCalculator(this.id, this.svgChar, p1, p2);
  }

  convert(svgChar: SvgChar) {
    return new LineCalculator(this.id, svgChar, this.p1, this.p2);
  }

  findTimeByDistance(distance: number) {
    return distance;
  }

  toCommand() {
    let points;
    switch (this.svgChar) {
      case 'L':
      case 'Z':
        points = [this.p1, this.p2];
        break;
      case 'Q':
        const cp = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 0.5),
          MathUtil.lerp(this.p1.y, this.p2.y, 0.5));
        points = [this.p1, cp, this.p2];
        break;
      case 'C':
        const cp1 = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 1 / 3),
          MathUtil.lerp(this.p1.y, this.p2.y, 1 / 3));
        const cp2 = new Point(
          MathUtil.lerp(this.p1.x, this.p2.x, 2 / 3),
          MathUtil.lerp(this.p1.y, this.p2.y, 2 / 3));
        points = [this.p1, cp1, cp2, this.p2];
        break;
      default:
        throw new Error('Invalid command type: ' + this.svgChar);
    }
    return new CommandBuilder(this.svgChar, points).setId(this.id).build();
  }

  getBoundingBox() {
    const minx = Math.min(this.p1.x, this.p2.x);
    const miny = Math.min(this.p1.y, this.p2.y);
    const maxx = Math.max(this.p1.x, this.p2.x);
    const maxy = Math.max(this.p1.y, this.p2.y);
    const x = { min: minx, max: maxx };
    const y = { min: miny, max: maxy };
    return { x, y } as BBox;
  }

  // TODO: test this
  intersects(line: Line) {
    if (this.p1.equals(this.p2)) {
      // Points can't be intersected.
      return [];
    }

    // Check to see if the line from (a,b) to (c,d) intersects
    // with the line from (p,q) to (r,s).
    const { x: a, y: b } = this.p1;
    const { x: c, y: d } = this.p2;
    const { p1: { x: p, y: q }, p2: { x: r, y: s } } = line;
    const det = round((c - a) * (s - q) - (r - p) * (d - b));
    if (det === 0) {
      // Then the two lines are parallel. In our case it is fine to
      // return an empty list, even though the lines may technically
      // be collinear.
      return [];
    } else {
      const t = round(((s - q) * (r - a) + (p - r) * (s - b)) / det);
      const u = round(((b - d) * (r - a) + (c - a) * (s - b)) / det);
      return (0 <= t && t <= 1) && (0 <= u && u <= 1) ? [t] : [];
    }
  }
}

function round(num: number) {
  return _.round(num, ROUNDING_PRECISION);
}
