import 'jasmine';
import { Point } from '.';

describe('Point', () => {
  it('constructor', () => {
    let point = new Point();
    expect(point.x).toBe(0);
    expect(point.y).toBe(0);

    point = new Point(1, 2);
    expect(point.x).toBe(1);
    expect(point.y).toBe(2);

    expect(point.equals(new Point(1, 2))).toBe(true);
  });
});
