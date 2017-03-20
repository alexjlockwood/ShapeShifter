import { SvgChar, newPath, Path, Command, PathMutator } from '.';
import { Matrix, Point } from '../common';
import * as _ from 'lodash';

describe('Path', () => {

  describe('constructing new Path objects', () => {
    function buildPath(svgChars: string) {
      const numSvgCharArgsFn = (svgChar: SvgChar) => {
        switch (svgChar) {
          case 'M':
          case 'L':
            return 2;
          case 'Q':
            return 4;
          case 'C':
            return 6;
          case 'Z':
            return 0;
        }
      };
      return newPath(svgChars.split('').map((svgChar: SvgChar) => {
        const args = '5'.repeat(numSvgCharArgsFn(svgChar)).split('').join(' ');
        return svgChar === 'Z' ? 'Z' : `${svgChar} ${args}`;
      }).join(' '));
    }

    const TESTS = [
      {
        desc: 'construct a Path containing one subpath',
        actual: 'MLLZ',
        expected: ['MLLZ', 1],
      },
      {
        desc: 'construct a Path containing two subpaths',
        actual: 'MLCQLZMZ',
        expected: ['MLCQLZMZ', 2],
      },
      // TODO: fix this test (SVGO probably makes this impossible, but just in case...)
      // {
      //   desc: 'construct a Path w/ multiple moveto commands',
      //   actual: 'MMMMMLLLLL',
      //   expected: ['MMMMMLLLLL', 5],
      // },
      {
        desc: 'construct a Path w/ multiple closepath commands',
        actual: 'MLCQLZMZZZZMLZMZZ',
        expected: ['MLCQLZMZMZMZMZMLZMZMZ', 8],
      },
      {
        desc: 'construct a complex compound path with multiple subpaths',
        actual: 'MLZMLLZMLMLLZLZLLZMLLMZM',
        expected: ['MLZMLLZMLMLLZMLZMLLZMLLMZM', 9],
      },
    ];

    for (const test of TESTS) {
      it(test.desc, () => {
        const actualPath = buildPath(test.actual);
        const actualSvgChars = _.flatMap(actualPath.getSubPaths(), subPath => {
          return subPath.getCommands().map(cmd => cmd.getSvgChar());
        }).join('');
        expect(actualSvgChars).toEqual(test.expected[0]);
        expect(actualPath.getSubPaths().length).toEqual(test.expected[1]);
      });
    }
  });

  describe('determine whether subpaths are open or closed', () => {
    const TESTS = [
      ['M 0 0 L 10 10 L 20 20', 0, false],
      ['M 0 0 L 10 10 L 20 20 Z', 0, true],
      ['M 5 5 h 10 v 10 h -10 v -10', 0, true],
      ['M 5 5 h 10 v 10 h -10 v -10 M 15 15 L 10 10 L 5 5', 0, true],
      ['M 5 5 h 10 v 10 h -10 v -10 M 15 15 L 10 10 L 5 5', 1, false],
    ];

    for (const test of TESTS) {
      it(`subpath #${test[1]} in '${test[0]}' is ${test[2] ? 'closed' : 'open'}`, () => {
        const path = newPath(test[0] as string);
        expect(path.getSubPaths()[test[1] as number].isClosed()).toEqual(test[2]);
      });
    }
  });

  describe('mutating Path objects', () => {
    type PathOp = 'RV' | 'SB' | 'SF' | 'S' | 'SIH' | 'US' | 'CV' | 'UCV' | 'T' | 'RT';

    function mutatePath(pathString: string, pathOpsString: string) {
      const A = pathOpsString.split(' ');
      const mutator = newPath(pathString).mutate();
      for (let i = 0; i < A.length; i++) {
        const op = A[i] as PathOp;
        switch (op) {
          case 'RV': // Reverse.
            mutator.reverseSubPath(+A[i + 1]);
            i += 1;
            break;
          case 'SB': // Shift back.
            mutator.shiftSubPathBack(+A[i + 1]);
            i += 1;
            break;
          case 'SF': // Shift forward.
            mutator.shiftSubPathForward(+A[i + 1]);
            i += 1;
            break;
          case 'S': // Split.
            const subIdx = +A[i + 1];
            const cmdIdx = +A[i + 2];
            const args = [+A[i + 3]];
            i += 3;
            while (!isNaN(+A[i + 1]) && i < A.length) {
              args.push(+A[i + 1]);
              i++;
            }
            mutator.splitCommand(subIdx, cmdIdx, ...args);
            break;
          case 'SIH': // Split in half.
            mutator.splitCommandInHalf(+A[i + 1], +A[i + 2]);
            i += 2;
            break;
          case 'US': // Unsplit.
            mutator.unsplitCommand(+A[i + 1], +A[i + 2]);
            i += 2;
            break;
          case 'CV': // Convert.
            mutator.convertCommand(+A[i + 1], +A[i + 2], A[i + 3] as SvgChar);
            i += 3;
            break;
          case 'UCV': // Unconvert.
            mutator.unconvertSubPath(+A[i + 1]);
            i += 1;
            break;
          case 'T': // Transform.
            // TODO: write this
            break;
          case 'RT': // Revert.
            mutator.revert();
            break;
          default:
            throw new Error('Invalid path op: ' + op);
        }
      }
      return mutator.build();
    }

    function makeTest(actual: string, ops: string, expected: string) {
      return { actual, ops, expected };
    }

    const MUTATION_TESTS = [
      makeTest(
        'M 0 0 10 10 20 20',
        'RV 0',
        'M 20 20 10 10 0 0',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 Z',
        'RV 0',
        'M 0 0 L 20 20 L 10 10 L 0 0',
      ),
      makeTest(
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
        'RV 0',
        'M 19 11 L 19 13 L 5 13 L 5 11 L 19 11',
      ),
      makeTest(
        'M 19 11 L 19 13 L 5 13 L 5 11 L 19 11',
        'RV 0',
        'M 19 11 L 5 11 L 5 13 L 19 13 L 19 11',
      ),
      makeTest(
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
        'RV 0 RV 0',
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
      ),
      makeTest(
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
        'SF 0',
        'M 5 11 L 5 13 L 19 13 L 19 11 L 5 11',
      ),
      makeTest(
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
        'SB 0 SF 0',
        'M 19 11 L 5 11 L 5 13 L 19 13 Z',
      ),
      makeTest(
        'M 19 11 C 19 11 5 11 5 11 C 5 11 5 13 5 13 L 19 13 L 19 11',
        'RV 0',
        'M 19 11 L 19 13 L 5 13 C 5 13 5 11 5 11 C 5 11 19 11 19 11',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20',
        'S 0 1 0.5',
        'M 0 0 L 5 5 L 10 10 L 20 20',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20',
        'SIH 0 1',
        'M 0 0 L 5 5 L 10 10 L 20 20',
      ),
      makeTest(
        'M 0 0 L 5 5 L 10 10 L 20 20',
        'SIH 0 2',
        'M 0 0 L 5 5 L 7.5 7.5 L 10 10 L 20 20',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20',
        'SIH 0 2',
        'M 0 0 L 10 10 L 15 15 L 20 20',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20',
        'RV 0 SIH 0 1',
        'M 20 20 L 15 15 L 10 10 L 0 0',
      ),
      // Split at t=0.
      makeTest(
        'M 0 0 L 0 10 L 10 10',
        'S 0 2 0',
        'M 0 0 L 0 10 L 0 10 L 10 10',
      ),
      // Split at t=1.
      makeTest(
        'M 0 0 L 0 10 L 10 10',
        'S 0 2 1',
        'M 0 0 L 0 10 L 10 10 L 10 10',
      ),
      // Split 0-length path.
      makeTest(
        'M 0 0 L 0 0',
        'S 0 1 0 S 0 1 0.5 S 0 1 1',
        'M 0 0 L 0 0 L 0 0 L 0 0 L 0 0',
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'S 0 2 0.25 0.5',
        'M 0 0 L 0 10 L 2.5 10 L 5 10 L 10 10 L 10 0 L 0 0',
      ),
      makeTest(
        'M 4 4 L 4 20 L 20 20 L 20 4 L 4 4',
        'SIH 0 4 SB 0',
        'M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 12 4',
      ),
      makeTest(
        'M 4 4 L 4 20 L 20 20 L 20 4 L 4 4',
        'SIH 0 4 SB 0 S 0 5 0.25 0.5 0.75',
        'M 12 4 L 4 4 L 4 20 L 20 20 L 20 4 L 18 4 L 16 4 L 14 4 L 12 4',
      ),
      // Split closepath command.
      makeTest(
        'M 0 0 L 0 10 L 10 10 Z',
        'S 0 3 0.5',
        'M 0 0 L 0 10 L 10 10 L 5 5 Z',
      ),
      // Split in half closepath command.
      makeTest(
        'M 0 0 L 0 10 L 10 10 Z',
        'SIH 0 3',
        'M 0 0 L 0 10 L 10 10 L 5 5 Z',
      ),
    ];

    for (const test of MUTATION_TESTS) {
      it(`[${test.ops}] '${test.actual}' → '${test.expected}'`, () => {
        checkPathsEqual(mutatePath(test.actual, test.ops), newPath(test.expected));
      });
    }

    it('command IDs persist correctly after mutations', () => {
      const totalIds = new Set();
      const extractPathIdsFn =
        (path: Path, expectedSize: number, expectedTotalSize: number) => {
          const ids = path.getCommands().map(cmd => cmd.getId());
          ids.forEach(id => totalIds.add(id));
          expect(new Set(ids).size).toEqual(expectedSize);
          expect(totalIds.size).toEqual(expectedTotalSize);
        };

      // Creating a new path generates 4 new ids.
      let path = newPath('M 0 0 L 0 0 L 0 0 L 0 0');
      extractPathIdsFn(path, 4, 4);

      // Reversing/shifting an existing path generates no new ids.
      path = path.mutate()
        .shiftSubPathBack(0)
        .reverseSubPath(0)
        .shiftSubPathForward(0)
        .build();
      extractPathIdsFn(path, 4, 4);

      // Splitting an existing path generates no new ids.
      path = path.mutate().splitCommand(0, 2, 0.25, 0.5, 0.75).build();
      extractPathIdsFn(path, 7, 7);

      // Creating new paths generate new IDs.
      path = newPath('M 0 0 L 0 0 L 0 0 L 0 0').mutate().shiftSubPathBack(0).build();
      extractPathIdsFn(path, 4, 11);

      path = newPath('M 0 0 L 0 0 L 0 0 L 0 0').mutate().reverseSubPath(0).build();
      extractPathIdsFn(path, 4, 15);
    });
  });

  // TODO: convert these into automated tests above.
  describe('convert/unconvert', () => {
    it('unconvert command', () => {
      let actual =
        newPath('M 0 0 L 1 1 C 2 2 2 2 2 2 L 3 3 C 4 4 4 4 4 4')
          .mutate().reverseSubPath(0).build();
      const expected =
        newPath('M 4 4 C 4 4 4 4 3 3 L 2 2 C 2 2 2 2 1 1 L 0 0');
      expect(actual.getPathString()).toEqual(expected.getPathString());

      actual = actual.mutate().convertCommand(0, 2, 'C').convertCommand(0, 4, 'C').build();
      let actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.getSvgChar());
      let expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];
      expect(actualSvgChars).toEqual(expectedSvgChars);

      actual = actual.mutate().reverseSubPath(0).build();
      actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.getSvgChar());
      expectedSvgChars = ['M', 'C', 'C', 'C', 'C'];

      actual = actual.mutate().unconvertSubPath(0).build();
      actualSvgChars = actual.getSubPaths()[0].getCommands().map(cmd => cmd.getSvgChar());
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
    expect(a.getSvgChar()).toEqual(e.getSvgChar());
    expect(a.getPoints().length).toEqual(e.getPoints().length);
    for (let j = 0; j < a.getPoints().length; j++) {
      const ap = a.getPoints()[j];
      const ep = e.getPoints()[j];
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

