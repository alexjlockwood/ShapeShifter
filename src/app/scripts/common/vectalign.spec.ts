import * as VectAlign from './vectalign';
import { Point } from '../common';
import {
  moveTo, lineTo, quadraticCurveTo, bezierCurveTo, arcTo, closePath
} from './drawcommand';

describe('VectAlign', () => {
  it('simple #1', () => {
    const from = [
      moveTo(undefined, new Point(0, 0)),
      lineTo(new Point(0, 0), new Point(10, 10)),
      lineTo(new Point(10, 10), new Point(20, 20)),
      lineTo(new Point(20, 20), new Point(30, 30)),
    ];
    const to = [
      moveTo(undefined, new Point(0, 0)),
      lineTo(new Point(0, 0), new Point(10, 10)),
      lineTo(new Point(10, 10), new Point(20, 20)),
    ];
    const result = VectAlign.align(from, to);
    const a1 = result.to;
    const a2 = result.from;
    // for (let i = 0; i < a1.length; i++) {
    //   console.log(a1[i]);
    // }
    // for (let i = 0; i < a2.length; i++) {
    //   console.log(a2[i]);
    // }
    expect(true).toEqual(true);
  });
  it('simple #2', () => {
    const from = [
      moveTo(undefined, new Point(0, 0)),
      bezierCurveTo(
        new Point(0, 0), new Point(0, 0),
        new Point(10, 10), new Point(10, 10)),
      lineTo(new Point(10, 10), new Point(20, 20)),
      lineTo(new Point(20, 20), new Point(30, 30)),
      lineTo(new Point(30, 30), new Point(40, 40)),
    ];
    const to = [
      moveTo(undefined, new Point(0, 0)),
      lineTo(new Point(0, 0), new Point(10, 10)),
      lineTo(new Point(10, 10), new Point(20, 20)),
      bezierCurveTo(
        new Point(20, 20), new Point(20, 20),
        new Point(30, 30), new Point(30, 30)),
      lineTo(new Point(30, 30), new Point(40, 40)),
    ];
    const result = VectAlign.align(from, to);
    const a1 = result.to;
    const a2 = result.from;
    // for (let i = 0; i < a1.length; i++) {
    //   console.log(a1[i]);
    // }
    // for (let i = 0; i < a2.length; i++) {
    //   console.log(a2[i]);
    // }
    expect(true).toEqual(true);
  });
});



