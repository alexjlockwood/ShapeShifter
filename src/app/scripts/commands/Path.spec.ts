import { SvgChar, newPath, Path, Command } from '.';
import { Matrix, Point } from '../common';
import * as _ from 'lodash';

describe('Path', () => {

  describe('constructor', () => {
    it('parse compound paths', () => {
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

    function newSimplePath(...svgChars: SvgChar[]) {
      return newPath(svgChars.map(svgChar => {
        return svgChar === 'Z' ? 'Z' : `${svgChar} 0 0`;
      }).join(' '));
    }
  });

  describe('reverse/shift', () => {
    it('reverse simple line', () => {
      let actual = newPath('M 0 0 L 10 10 L 20 20').reverse(0);
      let expected = newPath('M 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 10 10 L 20 20 Z').reverse(0);
      expected = newPath('M 0 0 L 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('reverse/shift w/ lines', () => {
      let actual = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z').reverse(0);
      let expected = newPath('M 19 11 L 19 13 L 5 13 L 5 11 L 19 11');
      checkPathsEqual(actual, expected);

      actual = actual.reverse(0);
      expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
      checkPathsEqual(actual, expected);

      actual = actual.shiftBack(0);
      expected = newPath('M 5 11 L 5 13 L 19 13 L 19 11 L 5 11');
      checkPathsEqual(actual, expected);

      actual = actual.shiftForward(0);
      expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
      checkPathsEqual(actual, expected);
    });

    it('reverse/shift w/ curves', () => {
      const actual = newPath(
        'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11').reverse(0);
      const expected = newPath(
        'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11');
      checkPathsEqual(actual, expected);
    });
  });

  describe('split/unsplit', () => {
    it('split line', () => {
      // TODO: use splitInHalf() instead
      let actual = newPath('M 0 0 L 10 10 L 20 20').split(0, 1, 0.5);
      let expected = newPath('M 0 0 L 5 5 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.split(0, 2, 0.5);
      expected = newPath('M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 10 10 L 20 20').split(0, 2, 0.5);
      expected = newPath('M 0 0 L 10 10 L 15 15 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.unsplit(0, 2);
      expected = newPath('M 0 0 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.reverse(0);
      expected = newPath('M 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.split(0, 1, 0.5);
      expected = newPath('M 20 20 L 15 15 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('split minus', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0').reverse(0);
      let expected = newPath('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.shiftBack(0);
      expected = newPath('M 10 0 L 10 10 L 0 10 L 0 0 L 10 0');
      checkPathsEqual(actual, expected);
    });

    it('multiple splits', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
          .split(0, 2, 0.25, 0.5);
      let expected =
        newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);

      actual = newPath('M 4 4 L 4 20 L 20 20 L 20 4 L 4 4')
        .splitInHalf(0, 4)
        .shiftForward(0);
      expected =
        newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4');
      checkPathsEqual(actual, expected);

      actual = actual.split(0, 5, 0.25, 0.5, 0.75);
      expected =
        newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 '
          + 'L 18 4 L 16 4 L 14 4 L 12 4');
      checkPathsEqual(actual, expected);
    });

    it('batch unsplit', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
          .split(0, 2, 0.25, 0.5);
      let expected =
        newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.unsplitBatch([{ subIdx: 0, cmdIdx: 2 }, { subIdx: 0, cmdIdx: 3 }]);
      expected = newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('split close path', () => {
      let actual = newPath('M 0 0 L 0 10 L 10 10 Z').split(0, 3, 0.5);
      let expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 0 10 L 10 10 Z').splitInHalf(0, 3);
      expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z').split(0, 5, 0.5);
      expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z').splitInHalf(0, 5);
      expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
      checkPathsEqual(actual, expected);
    });

    it('split at t=0', () => {
      const actual = newPath('M 0 0 L 0 10 L 10 10').split(0, 2, 0);
      const expected = newPath('M 0 0 L 0 10 L 0 10 L 10 10');
      checkPathsEqual(actual, expected);
    });

    it('split at t=1', () => {
      const actual = newPath('M 0 0 L 0 10 L 10 10').split(0, 2, 1);
      const expected = newPath('M 0 0 L 0 10 L 10 10 L 10 10');
      checkPathsEqual(actual, expected);
    });

    it('split 0-length path', () => {
      const actual = newPath('M 0 0 L 0 0')
        .split(0, 1, 0).split(0, 1, 0.5).split(0, 1, 1);
      const expected = newPath('M 0 0 L 0 0 L 0 0 L 0 0 L 0 0');
      checkPathsEqual(actual, expected);
    });
  });

  describe('convert/unconvert', () => {
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

      actual = actual.unconvertSubPath(0);
      actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
      expectedSvgChars = ['M', 'L', 'C', 'L', 'C'];
    });
  });

  // TODO: test multiple transformations at a time
  // TODO: test that reversals and stuff still work
  // TODO: test that splits and conversions and stuff still work
  // TODO: test that reversals/shifts/splits/etc. are reverted properly, not just transforms
  describe('#transform', () => {
    const INITIAL = newPath('M -4 -8 h 8 v 16 h -8 v -16');

    it('empty list of transforms', () => {
      const actual = INITIAL.transform([]);
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('identity', () => {
      const actual = INITIAL.transform([new Matrix()]);
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('translate', () => {
      const actual = INITIAL.transform([Matrix.fromTranslation(4, 8)]);
      const expected = newPath('M 0 0 h 8 v 16 h -8 v -16');
      checkPathsEqual(actual, expected);
    });

    it('rotate 90 degrees', () => {
      const actual = INITIAL.transform([Matrix.fromRotation(90)]);
      const expected = newPath('M 8 -4 v 8 h -16 v -8 h 16');
      checkPathsEqual(actual, expected);
    });

    it('rotate 180 degrees', () => {
      const actual = INITIAL.transform([Matrix.fromRotation(180)]);
      const expected = newPath('M 4 8 h -8 v -16 h 8 v 16');
      checkPathsEqual(actual, expected);
    });

    it('scale down 50%', () => {
      const actual = INITIAL.transform([Matrix.fromScaling(0.5, 0.5)]);
      const expected = newPath('M -2 -4 h 4 v 8 h -4 v -8');
      checkPathsEqual(actual, expected);
    });

    it('transform w/ inverse', () => {
      const m1 = Matrix.flatten(
        Matrix.fromTranslation(1, 2),
        Matrix.fromScaling(2, 3),
        Matrix.fromRotation(34),
        Matrix.fromTranslation(3, 4),
      );
      const m2 = m1.invert();
      const actual = INITIAL.transform([m1, m2]);
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('revert transformations', () => {
      const actual = INITIAL.transform([
        Matrix.fromTranslation(1, 2),
        Matrix.fromScaling(2, 3),
        Matrix.fromRotation(34),
        Matrix.fromTranslation(3, 4),
      ]).revert();
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });
  });

  describe('move sub paths', () => {
    const subPath0 = 'M 0 0 L 0 0 L 1 1';
    const subPath1 = 'M 1 1 L 2 1 L 3 1 L 1 1';
    const subPath2 = 'M 2 2 L 4 2 L 8 2';
    const INITIAL = newPath([subPath0, subPath1, subPath2].join(' '));

    it('move sub path to same location', () => {
      const actual = INITIAL.moveSubPath(0, 0);
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('move single sub path', () => {
      const actual = INITIAL.moveSubPath(0, 1);
      const expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);
    });

    it('move sub path and then move back to same location', () => {
      const actual =
        INITIAL.moveSubPath(0, 1).moveSubPath(1, 0).moveSubPath(1, 2).moveSubPath(2, 1);
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('move single sub path and then reverse', () => {
      let actual = INITIAL.moveSubPath(0, 1);
      let expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.reverse(0);
      expected = newPath(['M 1 1 L 3 1 L 2 1 L 1 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);
    });

    it('move single sub path, then reverse/shift/split, then move the sub path again', () => {
      let actual = INITIAL.moveSubPath(0, 1);
      let expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.reverse(0).shiftBack(0);
      expected = newPath(['M 3 1 L 2 1 L 1 1 L 3 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.splitInHalf(0, 1);
      expected = newPath(['M 3 1 L 2.5 1 L 2 1 L 1 1 L 3 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.shiftForward(0).reverse(0);
      expected = newPath(['M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.moveSubPath(2, 0).moveSubPath(2, 0).moveSubPath(2, 1);
      expected = newPath([subPath0, 'M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1', subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.unsplit(1, 2);
      expected = newPath([subPath0, `M 1 1 L 2 1 L 3 1 L 1 1`, subPath2].join(' '));
      checkPathsEqual(actual, expected);
    });
  });

  describe('#project', () => {
    const TESTS_PROJECT = [
      [new Point(5, 5), 'M 0 0 L 10 10', { subIdx: 0, cmdIdx: 1, projection: { x: 5, y: 5, d: 0, t: 0.5 } }],
    ];

    TESTS_PROJECT.forEach(a => {
      const point = a[0] as Point;
      const path = a[1] as string;
      it(`projecting '(${point.x},${point.y})' onto '${path}' yields ${JSON.stringify(a[2])}`, () => {
        const result = newPath(path).project(point);
        expect(result).toEqual(a[2]);
      });
    });
  });
});

function checkPathsEqual(actual: Path, expected: Path) {
  expect(actual.getPathString()).toEqual(expected.getPathString());
  checkCommandsEqual(actual.getCommands(), expected.getCommands());
}

function checkCommandsEqual(actual: ReadonlyArray<Command>, expected: ReadonlyArray<Command>) {
  expect(actual.length).toEqual(expected.length);
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i];
    const e = expected[i];
    expect(a.svgChar).toEqual(e.svgChar);
    expect(a.points.length).toEqual(e.points.length);
    for (let j = 0; j < a.points.length; j++) {
      const ap = a.points[j];
      const ep = e.points[j];
      if (!ap || !ep) {
        expect(ap).toEqual(undefined);
        expect(ep).toEqual(undefined);
      } else {
        expect(_.round(ap.x, 8)).toEqual(ep.x);
        expect(_.round(ap.y, 8)).toEqual(ep.y);
      }
    }
  }
}

function equals(p: Point) {
  const diffX = Math.abs(this.x - p.x);
  const diffY = Math.abs(this.y - p.y);
  return diffX < 1e-8 && diffY < 1e-8;
}
