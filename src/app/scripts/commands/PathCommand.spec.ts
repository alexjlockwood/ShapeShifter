import { newPathCommand } from '.';

describe('PathCommand', () => {
  it('reverse line', () => {
    let actual = newPathCommand('M 0 0 L 10 10 L 20 20').reverse(0);
    let expected = newPathCommand('M 20 20 L 10 10 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = newPathCommand('M 0 0 L 10 10 L 20 20 Z').reverse(0);
    expected = newPathCommand('M 0 0 L 20 20 L 10 10 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('reverse/shift minus w/ lines', () => {
    let actual = newPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z').reverse(0);
    let expected = newPathCommand('M 19 11 L 19 13 L 5 13 L 5 11 L 19 11');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.reverse(0);
    expected = newPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.shiftBack(0);
    expected = newPathCommand('M 5 11 L 5 13 L 19 13 L 19 11 L 5 11');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.shiftForward(0);
    expected = newPathCommand('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('reverse/shift minus w/ curves', () => {
    const actual = newPathCommand(
      'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11').reverse(0);
    const expected = newPathCommand(
      'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('split line', () => {
    // TODO: use splitInHalf() instead
    let actual = newPathCommand('M 0 0 L 10 10 L 20 20').split(0, 1, 0.5);
    let expected = newPathCommand('M 0 0 L 5 5 L 10 10 L 20 20');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.split(0, 2, 0.5);
    expected = newPathCommand('M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = newPathCommand('M 0 0 L 10 10 L 20 20').split(0, 2, 0.5);
    expected = newPathCommand('M 0 0 L 10 10 L 15 15 L 20 20');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.unsplit(0, 2);
    expected = newPathCommand('M 0 0 L 10 10 L 20 20');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.reverse(0);
    expected = newPathCommand('M 20 20 L 10 10 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.split(0, 1, 0.5);
    expected = newPathCommand('M 20 20 L 15 15 L 10 10 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('split minus', () => {
    let actual =
      newPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0').reverse(0);
    let expected = newPathCommand('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.shiftBack(0);
    expected = newPathCommand('M 10 0 L 10 10 L 0 10 L 0 0 L 10 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('multi-splits', () => {
    let actual =
      newPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
        .split(0, 2, 0.25, 0.5);
    let expected =
      newPathCommand('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = newPathCommand('M 4 4 L 4 20 L 20 20 L 20 4 L 4 4')
      .splitInHalf(0, 4)
      .shiftForward(0);
    expected =
      newPathCommand('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.split(0, 5, 0.25, 0.5, 0.75);
    expected =
      newPathCommand('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 '
        + 'L 18 4 L 16 4 L 14 4 L 12 4');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('batch unsplit', () => {
    let actual =
      newPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
        .split(0, 2, 0.25, 0.5);
    let expected =
      newPathCommand('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = newPathCommand('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0')
      .unsplitBatch([{ subIdx: 0, cmdIdx: 2 }, { subIdx: 0, cmdIdx: 3 }]);
    expected =
      newPathCommand('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('unconvert command', () => {
    let actual =
      newPathCommand('M 0 0 L 1 1 C 2 2 2 2 2 2 L 3 3 C 4 4 4 4 4 4')
        .reverse(0);
    const expected =
      newPathCommand('M 4 4 C 4 4 4 4 3 3 L 2 2 C 2 2 2 2 1 1 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());

    actual = actual.convert(0, 2, 'C').convert(0, 4, 'C');
    let actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    let expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];
    expect(actualSvgChars).toEqual(expectedSvgChars);

    actual = actual.reverse(0);
    actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];

    actual = actual.unconvert(0);
    actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    expectedSvgChars = ['M', 'L', 'C', 'L', 'C'];
  });

  it('split close path', () => {
    const actual = newPathCommand('M 0 0 L 0 10 L 10 10 Z').split(0, 3, 0.5);
    const expected = newPathCommand('M 0 0 L 0 10 L 10 10 L 5 5 Z');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('split at t=0', () => {
    const actual = newPathCommand('M 0 0 L 0 10 L 10 10').split(0, 2, 0);
    const expected = newPathCommand('M 0 0 L 0 10 L 0 10 L 10 10');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('split at t=1', () => {
    const actual = newPathCommand('M 0 0 L 0 10 L 10 10').split(0, 2, 1);
    const expected = newPathCommand('M 0 0 L 0 10 L 10 10 L 10 10');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });

  it('split path with path length 0', () => {
    const actual = newPathCommand('M 0 0 L 0 0')
      .split(0, 1, 0).split(0, 1, 0.5).split(0, 1, 1);
    const expected = newPathCommand('M 0 0 L 0 0 L 0 0 L 0 0 L 0 0');
    expect(actual.getPathData()).toEqual(expected.getPathData());
  });
});
