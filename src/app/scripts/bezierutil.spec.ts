import { Bezier, Projection, Split } from './bezierutil';
import { Point } from './mathutil';

describe('Bezier', () => {
  it('constructor', () => {
    const linePoints = [new Point(0, 0), new Point(10, 10)];
    const bezier = new Bezier(...linePoints);
    expect(bezier.points).toEqual([new Point(0, 0), new Point(10, 10), new Point(10, 10)]);
  });
});
