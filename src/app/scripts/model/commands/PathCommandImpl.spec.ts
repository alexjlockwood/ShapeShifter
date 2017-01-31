import { PathParser } from '../../import';
import { createPathCommand } from '.';

describe('PathCommand', () => {
  it('reverse line', () => {
    let actual = createPathCommand('M 0 0 L 10 10 L 20 20').reverse(0);
    let expected = createPathCommand('M 20 20 L 10 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = createPathCommand('M 0 0 L 10 10 L 20 20 Z').reverse(0);
    expected = createPathCommand('M 0 0 L 20 20 L 10 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('reverse/shift minus w/ lines', () => {
    let actual = createPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z').reverse(0);
    let expected = createPathCommand('M 19 11 L 19 13 L 5 13 L 5 11 L 19 11');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.reverse(0);
    expected = createPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.shiftBack(0);
    expected = createPathCommand('M 5 11 L 5 13 L 19 13 L 19 11 L 5 11');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.shiftForward(0);
    expected = createPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('reverse/shift minus w/ curves', () => {
    const actual = createPathCommand(
      'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11').reverse(0);
    const expected = createPathCommand(
      'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('split line', () => {
    // TODO: use splitInHalf() instead
    let actual = createPathCommand('M 0 0 L 10 10 L 20 20').split(0, 1, 0.5);
    let expected = createPathCommand('M 0 0 L 5 5 L 10 10 L 20 20');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.split(0, 2, 0.5);
    expected = createPathCommand('M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = createPathCommand('M 0 0 L 10 10 L 20 20').split(0, 2, 0.5);
    expected = createPathCommand('M 0 0 L 10 10 L 15 15 L 20 20');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.unsplit(0, 2);
    expected = createPathCommand('M 0 0 L 10 10 L 20 20');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.reverse(0);
    expected = createPathCommand('M 20 20 L 10 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.split(0, 1, 0.5);
    expected = createPathCommand('M 20 20 L 15 15 L 10 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('split minus', () => {
    let actual =
      createPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0').reverse(0);
    let expected = createPathCommand('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.shiftBack(0);
    expected = createPathCommand('M 10 0 L 10 10 L 0 10 L 0 0 L 10 0');
    expect(actual.pathString).toEqual(expected.pathString);
  });

  it('multi-splits', () => {
    let actual =
      createPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
        .split(0, 2, 0.25, 0.5);
    let expected =
      createPathCommand('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = createPathCommand('M 4 4 L 4 20 L 20 20 L 20 4 L 4 4')
      .splitInHalf(0, 4)
      .shiftForward(0);
    expected =
      createPathCommand('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4');
    expect(actual.pathString).toEqual(expected.pathString);

    actual = actual.split(0, 5, 0.25, 0.5, 0.75);
    expected =
      createPathCommand('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 '
        + 'L 18 4 L 16 4 L 14 4 L 12 4');
    expect(actual.pathString).toEqual(expected.pathString);
  });
});
