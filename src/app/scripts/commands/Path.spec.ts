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
      let actual = newPath('M 0 0 L 10 10 L 20 20').mutate()
        .reverseSubPath(0)
        .build();
      let expected = newPath('M 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 10 10 L 20 20 Z').mutate()
        .reverseSubPath(0)
        .build();
      expected = newPath('M 0 0 L 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('reverse/shift w/ lines', () => {
      let actual = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z').mutate()
        .reverseSubPath(0)
        .build();
      let expected = newPath('M 19 11 L 19 13 L 5 13 L 5 11 L 19 11');
      checkPathsEqual(actual, expected);

      actual = actual.mutate()
        .reverseSubPath(0)
        .build();
      expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
      checkPathsEqual(actual, expected);

      actual = actual.mutate()
        .shiftSubPathForward(0)
        .build();
      expected = newPath('M 5 11 L 5 13 L 19 13 L 19 11 L 5 11');
      checkPathsEqual(actual, expected);

      actual = actual.mutate()
        .shiftSubPathBack(0)
        .build();
      expected = newPath('M 19 11 L 5 11 L 5 13 L 19 13 Z');
      checkPathsEqual(actual, expected);
    });

    it('reverse/shift w/ curves', () => {
      const actual = newPath(
        'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11').mutate()
        .reverseSubPath(0)
        .build();
      const expected = newPath(
        'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11');
      checkPathsEqual(actual, expected);
    });
  });

  describe('split/unsplit', () => {
    it('split line', () => {
      // TODO: use splitInHalf() instead
      let actual = newPath('M 0 0 L 10 10 L 20 20').mutate()
        .splitCommand(0, 1, 0.5)
        .build();
      let expected = newPath('M 0 0 L 5 5 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().splitCommand(0, 2, 0.5).build();
      expected = newPath('M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 10 10 L 20 20').mutate()
        .splitCommand(0, 2, 0.5)
        .build();
      expected = newPath('M 0 0 L 10 10 L 15 15 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().unsplitCommand(0, 2).build();
      expected = newPath('M 0 0 L 10 10 L 20 20');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().reverseSubPath(0).build();
      expected = newPath('M 20 20 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().splitCommand(0, 1, 0.5).build();
      expected = newPath('M 20 20 L 15 15 L 10 10 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('split minus', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0').mutate()
          .reverseSubPath(0)
          .build();
      let expected = newPath('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().shiftSubPathForward(0).build();
      expected = newPath('M 10 0 L 10 10 L 0 10 L 0 0 L 10 0');
      checkPathsEqual(actual, expected);
    });

    it('multiple splits', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
          .mutate()
          .splitCommand(0, 2, 0.25, 0.5)
          .build();
      let expected =
        newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);

      actual = newPath('M 4 4 L 4 20 L 20 20 L 20 4 L 4 4')
        .mutate()
        .splitCommandInHalf(0, 4)
        .shiftSubPathBack(0)
        .build();
      expected =
        newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4');
      checkPathsEqual(actual, expected);

      actual = actual.mutate().splitCommand(0, 5, 0.25, 0.5, 0.75).build();
      expected =
        newPath('M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 '
          + 'L 18 4 L 16 4 L 14 4 L 12 4');
      checkPathsEqual(actual, expected);
    });

    it('batch unsplit', () => {
      let actual =
        newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0')
          .mutate()
          .splitCommand(0, 2, 0.25, 0.5)
          .build();
      let expected =
        newPath('M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);

      actual = actual.unsplitBatch([{ subIdx: 0, cmdIdx: 2 }, { subIdx: 0, cmdIdx: 3 }]);
      expected = newPath('M 0 0 L 0 10 L 10 10 L 10 0 L 0 0');
      checkPathsEqual(actual, expected);
    });

    it('split close path', () => {
      let actual = newPath('M 0 0 L 0 10 L 10 10 Z').mutate()
        .splitCommand(0, 3, 0.5).build();
      let expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 0 0 L 0 10 L 10 10 Z')
        .mutate()
        .splitCommandInHalf(0, 3)
        .build();
      expected = newPath('M 0 0 L 0 10 L 10 10 L 5 5 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z').mutate()
        .splitCommand(0, 5, 0.5)
        .build();
      expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
      checkPathsEqual(actual, expected);

      actual = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 Z')
        .mutate()
        .splitCommandInHalf(0, 5)
        .build();
      expected = newPath('M 8 8 L 16 8 L 16 16 L 8 16 L 8 8 L 8 8 Z');
      checkPathsEqual(actual, expected);
    });

    it('split at t=0', () => {
      const actual = newPath('M 0 0 L 0 10 L 10 10').mutate()
        .splitCommand(0, 2, 0)
        .build();
      const expected = newPath('M 0 0 L 0 10 L 0 10 L 10 10');
      checkPathsEqual(actual, expected);
    });

    it('split at t=1', () => {
      const actual = newPath('M 0 0 L 0 10 L 10 10').mutate()
        .splitCommand(0, 2, 1)
        .build();
      const expected = newPath('M 0 0 L 0 10 L 10 10 L 10 10');
      checkPathsEqual(actual, expected);
    });

    it('split 0-length path', () => {
      const actual = newPath('M 0 0 L 0 0').mutate()
        .splitCommand(0, 1, 0)
        .splitCommand(0, 1, 0.5)
        .splitCommand(0, 1, 1)
        .build();
      const expected = newPath('M 0 0 L 0 0 L 0 0 L 0 0 L 0 0');
      checkPathsEqual(actual, expected);
    });
  });

  describe('convert/unconvert', () => {
    it('unconvert command', () => {
      let actual =
        newPath('M 0 0 L 1 1 C 2 2 2 2 2 2 L 3 3 C 4 4 4 4 4 4')
          .mutate().reverseSubPath(0).build();
      const expected =
        newPath('M 4 4 C 4 4 4 4 3 3 L 2 2 C 2 2 2 2 1 1 L 0 0');
      expect(actual.getPathString()).toEqual(expected.getPathString());

      actual = actual.mutate().convertCommand(0, 2, 'C').convertCommand(0, 4, 'C').build();
      let actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
      let expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];
      expect(actualSvgChars).toEqual(expectedSvgChars);

      actual = actual.mutate().reverseSubPath(0).build();
      actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
      expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];

      actual = actual.mutate().unconvertSubPath(0).build();
      actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.svgChar);
      expectedSvgChars = ['M', 'L', 'C', 'L', 'C'];
    });
  });

  // TODO: test multiple transformations at a time
  // TODO: test that reversals and stuff still work
  // TODO: test that splits and conversions and stuff still work
  // TODO: test that reversals/shifts/splits/etc. are reverted properly, not just transforms
  describe('#transform', () => {
    const PATH = newPath('M -4 -8 h 8 v 16 h -8 v -16');

    it('empty list of transforms', () => {
      const actual = PATH.mutate().addTransforms([]).build();
      const expected = PATH;
      checkPathsEqual(actual, expected);
    });

    it('identity', () => {
      const actual = PATH.mutate().addTransforms([new Matrix()]).build();
      const expected = PATH;
      checkPathsEqual(actual, expected);
    });

    it('translate', () => {
      const actual = PATH.mutate().addTransforms([Matrix.fromTranslation(4, 8)]).build();
      const expected = newPath('M 0 0 h 8 v 16 h -8 v -16');
      checkPathsEqual(actual, expected);
    });

    it('rotate 90 degrees', () => {
      const actual = PATH.mutate().addTransforms([Matrix.fromRotation(90)]).build();
      const expected = newPath('M 8 -4 v 8 h -16 v -8 h 16');
      checkPathsEqual(actual, expected);
    });

    it('rotate 180 degrees', () => {
      const actual = PATH.mutate().addTransforms([Matrix.fromRotation(180)]).build();
      const expected = newPath('M 4 8 h -8 v -16 h 8 v 16');
      checkPathsEqual(actual, expected);
    });

    it('scale 50%', () => {
      const actual = PATH.mutate().addTransforms([Matrix.fromScaling(0.5, 0.5)]).build();
      const expected = newPath('M -2 -4 h 4 v 8 h -4 v -8');
      checkPathsEqual(actual, expected);
    });

    it('transform and invert', () => {
      const m1 = Matrix.flatten(
        Matrix.fromTranslation(1, 2),
        Matrix.fromScaling(2, 3),
        Matrix.fromRotation(34),
        Matrix.fromTranslation(3, 4),
      );
      const m2 = m1.invert();
      const actual = PATH.mutate().addTransforms([m1, m2]).build();
      const expected = PATH;
      checkPathsEqual(actual, expected);
    });

    it('revert transformations', () => {
      const actual = PATH.mutate().addTransforms([
        Matrix.fromTranslation(1, 2),
        Matrix.fromScaling(2, 3),
        Matrix.fromRotation(34),
        Matrix.fromTranslation(3, 4),
      ]).revert().build();
      const expected = PATH;
      checkPathsEqual(actual, expected);
    });
  });

  describe('move sub paths', () => {
    const subPath0 = 'M 0 0 L 0 0 L 1 1';
    const subPath1 = 'M 1 1 L 2 1 L 3 1 L 1 1';
    const subPath2 = 'M 2 2 L 4 2 L 8 2';
    const INITIAL = newPath([subPath0, subPath1, subPath2].join(' '));

    it('move sub path to same location', () => {
      const actual = INITIAL.mutate().moveSubPath(0, 0).build();
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('move single sub path', () => {
      const actual = INITIAL.mutate().moveSubPath(0, 1).build();
      const expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);
    });

    it('move sub path and then move back to same location', () => {
      const actual = INITIAL.mutate()
        .moveSubPath(0, 1)
        .moveSubPath(1, 0)
        .moveSubPath(1, 2)
        .moveSubPath(2, 1)
        .build();
      const expected = INITIAL;
      checkPathsEqual(actual, expected);
    });

    it('move single sub path and then reverse', () => {
      let actual = INITIAL.mutate().moveSubPath(0, 1).build();
      let expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().reverseSubPath(0).build();
      expected = newPath(['M 1 1 L 3 1 L 2 1 L 1 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);
    });

    it('move single sub path, then reverse/shift/split, then move the sub path again', () => {
      let actual = INITIAL.mutate().moveSubPath(0, 1).build();
      let expected = newPath([subPath1, subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().reverseSubPath(0).shiftSubPathForward(0).build();
      expected = newPath(['M 3 1 L 2 1 L 1 1 L 3 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().splitCommandInHalf(0, 1).build();
      expected = newPath(['M 3 1 L 2.5 1 L 2 1 L 1 1 L 3 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().shiftSubPathBack(0).reverseSubPath(0).build();
      expected = newPath(['M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1', subPath0, subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().moveSubPath(2, 0).moveSubPath(2, 0).moveSubPath(2, 1).build();
      expected = newPath([subPath0, 'M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1', subPath2].join(' '));
      checkPathsEqual(actual, expected);

      actual = actual.mutate().unsplitCommand(1, 2).build();
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

  describe('#hitTest', () => {
    const TESTS_HIT_TEST_FILL = [
      [new Point(5, 5), 'M 4 4 h 2 v 2 h -2 v -2', true],
      [new Point(5, 5), 'M 4 4 Q 5 4 6 4 Q 6 5 6 6 Q 5 6 4 6 Q 4 5 4 4', true],
    ];

    TESTS_HIT_TEST_FILL.forEach(a => {
      const point = a[0] as Point;
      const path = newPath(a[1] as string);
      it(`hit test for '(${point.x},${point.y})' on fill path '${a[1]}' yields '${a[2]}'`, () => {
        const hitResult = path.hitTest(point);
        expect(hitResult.isHit).toEqual(true);
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
