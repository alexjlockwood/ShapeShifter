import { Projection, SvgChar } from 'app/modules/editor/model/paths';
import { CommandBuilder } from 'app/modules/editor/model/paths/Command';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import BezierJs from 'bezier-js';
import { environment } from 'environments/environment';
import _ from 'lodash';

import { BBox, Calculator, Line } from '.';
import { LineCalculator } from './LineCalculator';
import { PointCalculator } from './PointCalculator';

/**
 * A simple typed wrapper class around the amazing bezier-js library.
 */
export class BezierCalculator implements Calculator {
  private readonly points: ReadonlyArray<Point>;
  private length: number | undefined;
  private bbox: BBox | undefined;
  private bezierJs_: any;

  constructor(
    private readonly id: string,
    private readonly svgChar: SvgChar,
    ...points: Point[]
  ) {
    this.points = points;

    // Don't initialize variables lazily for dev builds (to avoid
    // ngrx-store-freeze crashes).
    if (!environment.production) {
      this.getPathLength();
      this.getBoundingBox();
    }
  }

  private get bezierJs() {
    if (this.bezierJs_ === undefined) {
      this.bezierJs_ = new BezierJs(this.points);
    }
    return this.bezierJs_;
  }

  getPointAtLength(distance: number) {
    return this.bezierJs.get(this.findTimeByDistance(distance / this.getPathLength())) as Point;
  }

  getPathLength() {
    if (this.length === undefined) {
      this.length = this.bezierJs.length() as number;
    }
    return this.length;
  }

  project(point: Point): Projection {
    // Create a new bezier curve for dev builds to avoid ngrx-store-freeze crashes.
    const bezierJs = !environment.production ? new BezierJs(this.points) : this.bezierJs;
    const { x, y, t, d } = bezierJs.project(point);
    return { x, y, t, d };
  }

  split(t1: number, t2: number): Calculator {
    if (t1 === t2) {
      return new PointCalculator(this.id, this.svgChar, this.bezierJs.get(t1) as Point);
    }
    const points: ReadonlyArray<Point> = this.bezierJs.split(t1, t2).points;
    const uniquePoints: Point[] = _.uniqWith(points, MathUtil.arePointsEqual);
    if (uniquePoints.length === 2) {
      return new LineCalculator(this.id, this.svgChar, points[0], points[points.length - 1]);
    }
    return new BezierCalculator(this.id, this.svgChar, ...points);
  }

  convert(svgChar: SvgChar) {
    if (svgChar === undefined) {
      throw new Error('Attempt to convert an undefined svgChar');
    }
    if (this.svgChar === 'Q' && svgChar === 'C') {
      const qcp0 = this.points[0];
      const qcp1 = this.points[1];
      const qcp2 = this.points[2];
      const ccp0 = qcp0;
      const ccp1 = {
        x: qcp0.x + (2 / 3) * (qcp1.x - qcp0.x),
        y: qcp0.y + (2 / 3) * (qcp1.y - qcp0.y),
      };
      const ccp2 = {
        x: qcp2.x + (2 / 3) * (qcp1.x - qcp2.x),
        y: qcp2.y + (2 / 3) * (qcp1.y - qcp2.y),
      };
      const ccp3 = qcp2;
      return new BezierCalculator(this.id, svgChar, ccp0, ccp1, ccp2, ccp3);
    }
    return new BezierCalculator(this.id, svgChar, ...this.points);
  }

  /** Returns the time at which the curve has covered the given fraction of its length. */
  findTimeByDistance(distance: number): number {
    if (!Number.isFinite(distance)) {
      console.warn('distance must be a number between 0 and 1.');
      return 0;
    }
    if (distance <= 0 || distance >= 1 || !this.getPathLength()) {
      // A curve with no length is at its start and end at every time.
      return _.clamp(distance, 0, 1);
    }
    // The length covered only grows with time, so bisect. (Searching outward from t = distance,
    // as this used to, couldn't reach times more than a quarter away, which curves that speed up
    // or slow down a lot need.)
    const targetLength = distance * this.getPathLength();
    const tolerance = this.getPathLength() * 1e-6;
    let low = 0;
    let high = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      const excess = (this.bezierJs.split(mid).left.length() as number) - targetLength;
      if (Math.abs(excess) < tolerance) {
        return mid;
      }
      if (excess < 0) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  toCommand() {
    return new CommandBuilder(this.svgChar, [...this.points]).setId(this.id).build();
  }

  getBoundingBox() {
    if (this.bbox === undefined) {
      const bbox = this.bezierJs.bbox();
      this.bbox = {
        x: { min: bbox.x.min, max: bbox.x.max },
        y: { min: bbox.y.min, max: bbox.y.max },
      };
    }
    return this.bbox;
  }

  intersects(line: Line): number[] {
    if (MathUtil.arePointsEqual(this.points[0], this.points[this.points.length - 1])) {
      // Points can't be intersected.
      return [];
    }
    return this.bezierJs.intersects(line);
  }
}
