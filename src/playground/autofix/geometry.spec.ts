import {
  findMismatch,
  interpolate,
  measure,
  parsePath,
  signedArea,
  toPathString,
} from './geometry';

describe('geometry', () => {
  it('parses and writes path strings', () => {
    const pathString = 'M 0 0 L 10 0 Q 10 10 0 10 Z M 20 20 C 21 21 22 22 23 23';
    expect(toPathString(parsePath(pathString))).toEqual(pathString);
  });

  it('ends a Z at the start of its subpath', () => {
    const [[, , z]] = parsePath('M 1 2 L 3 4 Z');
    expect(z.points).toEqual([{ x: 1, y: 2 }]);
  });

  it("rejects commands Path.getPathString() doesn't write", () => {
    expect(() => parsePath('M 0 0 l 10 10')).toThrow();
    expect(() => parsePath('M 0 0 L 10')).toThrow();
  });

  it('finds commands that keep two paths from morphing', () => {
    const square = parsePath('M 0 0 L 1 0 L 1 1 Z');
    expect(findMismatch(square, parsePath('M 5 5 L 6 5 L 6 6 Z'))).toBeUndefined();
    expect(findMismatch(square, parsePath('M 5 5 L 6 5 L 6 6 L 5 5'))).toEqual(
      'command 4 is Z vs. L',
    );
    expect(findMismatch(square, parsePath('M 5 5 L 6 5 Z'))).toEqual('4 commands vs. 3');
  });

  it('interpolates every point', () => {
    const a = parsePath('M 0 0 C 0 10 10 10 10 0');
    const b = parsePath('M 10 10 C 10 20 20 20 20 10');
    expect(toPathString(interpolate(a, b, 0.5))).toEqual('M 5 5 C 5 15 15 15 15 5');
  });

  it('measures clockwise areas as positive', () => {
    const [clockwise] = parsePath('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const [counterclockwise] = parsePath('M 0 0 L 0 10 L 10 10 L 10 0 Z');
    expect(signedArea(clockwise)).toBeCloseTo(100);
    expect(signedArea(counterclockwise)).toBeCloseTo(-100);
  });

  it('measures how far points travel', () => {
    const a = parsePath('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const b = parsePath('M 0 0 L 10 0 L 10 10 L 0 20 Z');
    const { meanTravel, maxTravel, oppositeWindings } = measure(a, b, 'fill');
    const size = Math.hypot(10, 20);
    expect(maxTravel).toBeCloseTo(10 / size);
    expect(meanTravel).toBeCloseTo(10 / size / 4);
    expect(oppositeWindings).toEqual(0);
  });

  it('notices a morph that turns inside out', () => {
    const a = parsePath('M 0 0 L 10 0 L 10 10 L 0 10 Z');
    const b = parsePath('M 0 0 L 0 10 L 10 10 L 10 0 Z');
    const { oppositeWindings, worstArea } = measure(a, b, 'fill');
    expect(oppositeWindings).toEqual(1);
    expect(worstArea).toBeCloseTo(0);
  });

  it('ignores the direction of collapsing subpaths', () => {
    const a = parsePath('M 5 5 L 5 5 L 5 5 L 5 5 Z');
    const b = parsePath('M 0 0 L 0 10 L 10 10 L 10 0 Z');
    expect(measure(a, b, 'fill').oppositeWindings).toEqual(0);
  });
});
