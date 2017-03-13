import { SvgChar, newPath } from '.';
import { Matrix } from '../common';
import * as _ from 'lodash';

describe('Path construct', () => {
  it('parse complex subpaths', () => {
    const svgChars: SvgChar[][] = [
      ['M', 'L', 'Z'],
      ['M', 'L', 'L', 'Z'],
      ['M', 'L'],
      ['M', 'L', 'L', 'Z'],
      ['L', 'Z'],
      ['L', 'L', 'Z'],
      ['M', 'L', 'L'],
      ['M', 'Z'],
      ['M'],
    ];
    const pathCmd = newSimplePath(..._.flatten(svgChars));
    const actual = pathCmd.getSubPaths().map(subPathCmd => {
      return subPathCmd.getCommands().map(cmd => cmd.svgChar);
    });
    const expected: SvgChar[][] = [
      ['M', 'L', 'Z'],
      ['M', 'L', 'L', 'Z'],
      ['M', 'L'],
      ['M', 'L', 'L', 'Z'],
      ['M', 'L', 'Z'],
      ['M', 'L', 'L', 'Z'],
      ['M', 'L', 'L'],
      ['M', 'Z'],
      ['M'],
    ];
    expect(actual).toEqual(expected);
  });
});

describe('Path reverse/shift', () => {
  it('reverse simple line', () => {
    let actual = newPath('M 0 0 L 10 10 L 20 20').reverse(0);
    let expected = newPath('M 20 20 L 10 10 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 0 0 L 10 10 L 20 20 Z').reverse(0);
    expected = newPath('M 0 0 L 20 20 L 10 10 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('reverse/shift w/ lines', () => {
    let actual = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z').reverse(0);
    let expected = newPath('M 19 11 L 19 13 L 5 13 L 5 11 L 19 11');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.reverse(0);
    expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.shiftBack(0);
    expected = newPath('M 5 11 L 5 13 L 19 13 L 19 11 L 5 11');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.shiftForward(0);
    expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('reverse/shift w/ curves', () => {
    const actual = newPath(
      'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11').reverse(0);
    const expected = newPath(
      'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });
});

describe('Path split/unsplit', () => {
  it('split line', () => {
    // TODO: use splitInHalf() instead
    let actual = newPath('M 0 0 L 10 10 L 20 20').split(0, 1, 0.5);
    let expected = newPath('M 0 0 L 5 5 L 10 10 L 20 20');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.split(0, 2, 0.5);
    expected = newPath('M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 0 0 L 10 10 L 20 20').split(0, 2, 0.5);
    expected = newPath('M 0 0 L 10 10 L 15 15 L 20 20');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.unsplit(0, 2);
    expected = newPath('M 0 0 L 10 10 L 20 20');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.reverse(0);
    expected = newPath('M 20 20 L 10 10 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.split(0, 1, 0.5);
    expected = newPath('M 20 20 L 15 15 L 10 10 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('split minus', () => {
    let actual =
      newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0').reverse(0);
    let expected = newPath('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.shiftBack(0);
    expected = newPath('M 10 0 L 10 10 L 0 10 L 0 0 L 10 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('multiple splits', () => {
    let actual =
      newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
        .split(0, 2, 0.25, 0.5);
    let expected =
      newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 4 4 L 4 20 L 20 20 L 20 4 L 4 4')
      .splitInHalf(0, 4)
      .shiftForward(0);
    expected =
      newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.split(0, 5, 0.25, 0.5, 0.75);
    expected =
      newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 '
        + 'L 18 4 L 16 4 L 14 4 L 12 4');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('batch unsplit', () => {
    let actual =
      newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
        .split(0, 2, 0.25, 0.5);
    let expected =
      newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0')
      .unsplitBatch([{ subIdx: 0, cmdIdx: 2 }, { subIdx: 0, cmdIdx: 3 }]);
    expected =
      newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('split close path', () => {
    let actual = newPath('M 0 0 L 0 10 L 10 10 Z').split(0, 3, 0.5);
    let expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 0 0 L 0 10 L 10 10 Z').splitInHalf(0, 3);
    expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z').split(0, 5, 0.5);
    expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z').splitInHalf(0, 5);
    expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('split at t=0', () => {
    const actual = newPath('M 0 0 L 0 10 L 10 10').split(0, 2, 0);
    const expected = newPath('M 0 0 L 0 10 L 0 10 L 10 10');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('split at t=1', () => {
    const actual = newPath('M 0 0 L 0 10 L 10 10').split(0, 2, 1);
    const expected = newPath('M 0 0 L 0 10 L 10 10 L 10 10');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('split 0-length path', () => {
    const actual = newPath('M 0 0 L 0 0')
      .split(0, 1, 0).split(0, 1, 0.5).split(0, 1, 1);
    const expected = newPath('M 0 0 L 0 0 L 0 0 L 0 0 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });
});

describe('Path convert/unconvert', () => {
  it('unconvert command', () => {
    let actual =
      newPath('M 0 0 L 1 1 C 2 2 2 2 2 2 L 3 3 C 4 4 4 4 4 4')
        .reverse(0);
    const expected =
      newPath('M 4 4 C 4 4 4 4 3 3 L 2 2 C 2 2 2 2 1 1 L 0 0');
    expect(actual.getPathString()).toEqual(expected.getPathString());

    actual = actual.convert(0, 2, 'C').convert(0, 4, 'C');
    let actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    let expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];
    expect(actualSvgChars).toEqual(expectedSvgChars);

    actual = actual.reverse(0);
    actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];

    actual = actual.unconvertSubpath(0);
    actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
    expectedSvgChars = ['M', 'L', 'C', 'L', 'C'];
  });
});

// TODO: test multiple transformations at a time
// TODO: test that reversals and stuff still work
// TODO: test that splits and conversions and stuff still work
// TODO: test that reversals/shifts/splits/etc. are reverted properly, not just transforms
describe('Path transform', () => {
  const INITIAL = newPath('M -4 -8 h 8 v 16 h -8 v -16');

  it('empty list of transforms', () => {
    const actual = INITIAL.transform([]);
    const expected = INITIAL;
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('identity', () => {
    const actual = INITIAL.transform([new Matrix()]);
    const expected = INITIAL;
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('translate', () => {
    const actual = INITIAL.transform([Matrix.fromTranslation(4, 8)]);
    const expected = newPath('M 0 0 h 8 v 16 h -8 v -16');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('rotate 90 degrees', () => {
    const actual = INITIAL.transform([Matrix.fromRotation(90)]);
    const expected = newPath('M 8 -4 v 8 h -16 v -8 h 16');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('rotate 180 degrees', () => {
    const actual = INITIAL.transform([Matrix.fromRotation(180)]);
    const expected = newPath('M 4 8 h -8 v -16 h 8 v 16');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('scale down 50%', () => {
    const actual = INITIAL.transform([Matrix.fromScaling(0.5, 0.5)]);
    const expected = newPath('M -2 -4 h 4 v 8 h -4 v -8');
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });

  it('revert transformations', () => {
    const actual = INITIAL.transform([
      Matrix.fromTranslation(1, 2),
      Matrix.fromScaling(2, 3),
      Matrix.fromRotation(34),
      Matrix.fromTranslation(3, 4),
    ]).revert();
    const expected = INITIAL;
    expect(actual.getPathString()).toEqual(expected.getPathString());
  });
});

function newSimplePath(...svgChars: SvgChar[]) {
  return newPath(svgChars.map(svgChar => {
    return svgChar === 'Z' ? 'Z' : `${svgChar} 0 0`;
  }).join(' '));
}
