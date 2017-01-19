import * as PathParser from './pathparser';
import { createPathCommand } from './pathcommand';

describe('PathCommand', () => {
  it('reverse #1', () => {
    const actual = createPathCommand('M 0 0 L 10 10 L 20 20 L 30 30').reverse(0);
    const expected = createPathCommand('M 30 30 L 20 20 L 10 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('reverse #2', () => {
    const actual = createPathCommand('M 0 0 L 10 10 L 20 20 L 30 30 Z').reverse(0);
    const expected = createPathCommand('M 0 0 L 30 30 L 20 20 L 10 10 Z');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('split #1', () => {
    const actual = createPathCommand('M 0 0 L 10 10 L 20 20 L 30 30').split(0, 1, 0.5);
    const expected = createPathCommand('M 0 0 L 5 5 L 10 10 L 20 20 L 30 30');
    expect(actual.pathString).toEqual(expected.pathString);
  });
});
