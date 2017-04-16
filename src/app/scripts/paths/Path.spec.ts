import { SvgChar, newPath, Path, Command, ProjectionOntoPath } from '.';
import { Matrix, Point, MathUtil } from '../common';
import * as _ from 'lodash';

const lerp = MathUtil.lerp;

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
      // TODO: fix this test (SVGO probably makes it impossible, but just in case...)
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
        expect(actualSvgChars).toEqual(test.expected[0] as string);
        expect(actualPath.getSubPaths().length).toEqual(test.expected[1] as number);
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
        expect(path.getSubPaths()[test[1] as number].isClosed()).toEqual(test[2] as boolean);
      });
    }
  });


  type PathOp = 'RV' | 'SB' | 'SF' | 'S' | 'SIH' | 'US' | 'CV' | 'UCV' | 'RT' | 'M'
    | 'AC' | 'DC' | 'SSSP' | 'SFSP' | 'DSPSS' | 'USSSP' | 'USFSP' | 'T';

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
        case 'RT': // Revert.
          mutator.revert();
          break;
        case 'M': // Move subpath.
          mutator.moveSubPath(+A[i + 1], +A[i + 2]);
          i += 2;
          break;
        case 'AC': // Add collapsing sub path.
          mutator.addCollapsingSubPath(new Point(+A[i + 1], +A[i + 2]), +A[i + 3]);
          i += 3;
          break;
        case 'DC': // Delete collapsing sub paths.
          mutator.deleteCollapsingSubPaths();
          break;
        case 'SSSP': // Split stroked sub path.
          mutator.splitStrokedSubPath(+A[i + 1], +A[i + 2]);
          i += 2;
          break;
        case 'SFSP': // Split filled sub path.
          mutator.splitFilledSubPath(+A[i + 1], +A[i + 2], +A[i + 3]);
          i += 3;
          break;
        case 'DSPSS': // Delete sub path split segment.
          mutator.deleteSubPathSplitSegment(+A[i + 1], +A[i + 2]);
          i += 2;
          break;
        case 'USSSP': // Unsplit stroked sub path.
          mutator.unsplitStrokedSubPath(+A[i + 1]);
          i += 1;
          break;
        case 'USFSP': // Unsplit stroked sub path.
          mutator.unsplitStrokedSubPath(+A[i + 1]);
          i += 1;
          break;
        case 'T': // Transform.
          const isTransformOpFn = (token: string) => {
            token = (token || '').toLowerCase();
            return new Set(['scale', 'rotate', 'translate']).has(token);
          };
          while (isTransformOpFn(A[i + 1])) {
            const transformOp = A[i + 1];
            let matrix: Matrix;
            switch (transformOp) {
              case 'scale':
                matrix = Matrix.fromScaling(+A[i + 2], +A[i + 3]);
                i += 3;
                break;
              case 'rotate':
                matrix = Matrix.fromRotation(+A[i + 2]);
                i += 2;
                break;
              case 'translate':
                matrix = Matrix.fromTranslation(+A[i + 2], +A[i + 3]);
                i += 3;
                break;
              default:
                throw new Error('Invalid transform op: ' + transformOp);
            }
            mutator.addTransforms([matrix]);
          }
          break;
        default:
          throw new Error('Invalid path op: ' + op);
      }
    }
    return mutator.build();
  }

  describe('mutating Path objects', () => {
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

    function makeTest(actual: string, ops: string, expected: string) {
      return { actual, ops, expected };
    }

    const MUTATION_TESTS = [
      // Reverse/shift commands.
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
      // Split commands.
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
      makeTest(
        'M 20 22 L 4 22 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z',
        'S 0 2 0.5',
        'M 20 22 L 4 22 L 4 12 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z',
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
      // Move sub paths.
      makeTest(
        'M 0 0 L 0 0 L 1 1',
        'M 0 0',
        'M 0 0 L 0 0 L 1 1',
      ),
      makeTest(
        'M 0 0 L 0 0 L 0 0 M 1 1 L 1 1 L 1 1 M 2 2 L 2 2 L 2 2',
        'M 0 1',
        'M 1 1 L 1 1 L 1 1 M 0 0 L 0 0 L 0 0 M 2 2 L 2 2 L 2 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 1 1 L 1 1 M 2 2 L 2 2 L 2 2',
        'M 0 1',
        'M 1 1 L 1 1 L 1 1 M 0 0 L 0 0 L 1 1 M 2 2 L 2 2 L 2 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1',
        'M 1 1 L 2 1 L 3 1 L 1 1 M 0 0 L 0 0 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 M 1 0 M 1 2 M 2 1',
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0',
        'M 1 1 L 3 1 L 2 1 L 1 1 M 0 0 L 0 0 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0 SF 0',
        'M 3 1 L 2 1 L 1 1 L 3 1 M 0 0 L 0 0 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0 SF 0 SIH 0 1',
        'M 3 1 L 2.5 1 L 2 1 L 1 1 L 3 1 M 0 0 L 0 0 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0 SF 0 SIH 0 1 SB 0 RV 0',
        'M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1 M 0 0 L 0 0 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0 SF 0 SIH 0 1 SB 0 RV 0 M 2 0 M 2 0 M 2 1',
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 2.5 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
        'M 0 1 RV 0 SF 0 SIH 0 1 SB 0 RV 0 M 2 0 M 2 0 M 2 1 US 1 2',
        'M 0 0 L 0 0 L 1 1 M 1 1 L 2 1 L 3 1 L 1 1 M 2 2 L 4 2 L 8 2',
      ),
      makeTest(
        'M 1 1 L 2 2 L 3 3 M 10 10 L 20 20 L 30 30',
        'M 0 1 AC 3 4 2',
        'M 10 10 L 20 20 L 30 30 M 1 1 L 2 2 L 3 3 M 3 4 L 3 4',
      ),
      makeTest(
        'M 0 0 L 0 0 M 1 1 L 1 1 M 2 2 L 2 2 M 3 3 L 3 3 M 4 4 L 4 4 L 4 4',
        'M 1 4',
        'M 0 0 L 0 0 M 2 2 L 2 2 M 3 3 L 3 3 M 4 4 L 4 4 L 4 4 M 1 1 L 1 1',
      ),
      makeTest(
        'M 9 4 C 9 2.89 9.89 2 11 2 C 12.11 2 13 2.89 13 4 C 13 5.11 12.11 6 11 6 C 9.89 6 9 5.11 9 4 Z '
        + 'M 16 13 C 16 14.333 16 15.667 16 17 C 15 17 14 17 13 17 C 13 18.667 13 20.333 13 22 C 12 22 11 22 10 22 '
        + 'C 10 20.333 10 18.667 10 17 C 9.333 17 8.667 17 8 17 C 8 14.667 8 12.333 8 10 C 8 8.34 9.34 7 11 7 C 12.66 7 14 8.34 14 10 '
        + 'C 15.17 10.49 15.99 11.66 16 13 L 16 13 M 15 5.5 C 15 5.5 15 5.5 15 5.5 C 15 5.5 15 5.5 15 5.5 C 15 5.5 15 5.5 15 5.5 '
        + 'C 15 5.5 15 5.5 15 5.5 L 15 5.5 M 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 '
        + 'C 19.5 9.5 19.5 9.5 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 L 19.5 9.5 M 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 L 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 L 11.99 16.24',
        'M 1 4',
        'M 9 4 C 9 2.89 9.89 2 11 2 C 12.11 2 13 2.89 13 4 C 13 5.11 12.11 6 11 6 C 9.89 6 9 5.11 9 4 Z '
        + 'M 15 5.5 C 15 5.5 15 5.5 15 5.5 C 15 5.5 15 5.5 15 5.5 C 15 5.5 15 5.5 15 5.5 '
        + 'C 15 5.5 15 5.5 15 5.5 L 15 5.5 M 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 '
        + 'C 19.5 9.5 19.5 9.5 19.5 9.5 C 19.5 9.5 19.5 9.5 19.5 9.5 L 19.5 9.5 M 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 L 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 '
        + 'C 11.99 16.24 11.99 16.24 11.99 16.24 C 11.99 16.24 11.99 16.24 11.99 16.24 L 11.99 16.24'
        + 'M 16 13 C 16 14.333 16 15.667 16 17 C 15 17 14 17 13 17 C 13 18.667 13 20.333 13 22 C 12 22 11 22 10 22 '
        + 'C 10 20.333 10 18.667 10 17 C 9.333 17 8.667 17 8 17 C 8 14.667 8 12.333 8 10 C 8 8.34 9.34 7 11 7 C 12.66 7 14 8.34 14 10 '
        + 'C 15.17 10.49 15.99 11.66 16 13 L 16 13',
      ),
      // Convert/unconvert commands.
      makeTest(
        'M 0 0 L 3 3',
        'CV 0 1 C',
        'M 0 0 C 1 1 2 2 3 3',
      ),
      makeTest(
        'M 0 0 L 3 3',
        'CV 0 1 C UCV 0',
        'M 0 0 L 3 3',
      ),
      // Transform paths.
      makeTest(
        'M-4-8h8v16h-8v-16',
        'T translate 4 8',
        'M0 0h8v16h-8v-16',
      ),
      makeTest(
        'M-4-8h8v16h-8v-16',
        'T rotate 90',
        'M 8 -4 v 8 h -16 v -8 h 16',
      ),
      makeTest(
        'M-4-8h8v16h-8v-16',
        'T rotate 180',
        'M 4 8 h -8 v -16 h 8 v 16',
      ),
      makeTest(
        'M-4-8h8v16h-8v-16',
        'T scale 0.5 0.5',
        'M -2 -4 h 4 v 8 h -4 v -8',
      ),
      makeTest(
        'M-4-8h8v16h-8v-16',
        'T translate 1 2 scale 2 3 rotate 34 translate 3 4 RT',
        'M-4-8h8v16h-8v-16',
      ),
      // Add/delete collapsing sub paths.
      makeTest(
        'M 0 0 L 3 3',
        'AC 5 5 10',
        `M 0 0 L 3 3 M 5 5${' L 5 5'.repeat(9)}`,
      ),
      makeTest(
        'M 0 0 L 3 3',
        'AC 5 5 5 AC 3 4 6',
        `M 0 0 L 3 3 M 5 5${' L 5 5'.repeat(4)} M 3 4${' L 3 4'.repeat(5)}`,
      ),
      makeTest(
        'M 1 1 L 3 3 L 1 1',
        'AC 5 5 5 AC 3 4 6 M 0 1',
        `M 5 5${' L 5 5'.repeat(4)} M 1 1 L 3 3 L 1 1 M 3 4${' L 3 4'.repeat(5)}`,
      ),
      makeTest(
        'M 1 1 L 3 3 L 1 1',
        'AC 5 5 5 AC 3 4 6 M 0 1 DC',
        `M 1 1 L 3 3 L 1 1`,
      ),
      makeTest(
        'M 1 1 L 3 3 L 1 1',
        'AC 5 5 5 AC 3 4 6 M 0 1 RT',
        `M 1 1 L 3 3 L 1 1`,
      ),
      makeTest(
        'M 1 1 L 2 2 L 3 3 M 10 10 L 20 20 L 30 30',
        'AC 3 4 2',
        'M 1 1 L 2 2 L 3 3 M 10 10 L 20 20 L 30 30 M 3 4 L 3 4',
      ),
      // Split/unsplit stroked sub paths.
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1',
        'M 0 0 L 1 1 M 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1 USSSP 0',
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1 M 0 1',
        'M 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 1 1 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1 M 0 1 USSSP 1',
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1 USSSP 1',
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SSSP 0 1 SSSP 2 2',
        'M 0 0 L 1 1 M 1 1 L 2 2 L 3 3 L 4 4 L 5 5 M 0 0 L 10 10 L 20 20 M 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4',
        'M 0 0 L 10 10 L 20 20 L 30 30 L 35 35 M 35 35 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6',
        'M 35 35 L 38 38 L 40 40 L 50 50 M 0 0 L 10 10 L 20 20 L 30 30 L 35 35',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5',
        'M 50 50 L 40 40 L 39 39 L 38 38 L 35 35 M 0 0 L 10 10 L 20 20 L 30 30 L 35 35',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5 RT',
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5 RT '
        + 'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5 RT '
        + 'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RT',
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30 L 40 40 L 50 50',
        'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5 RT '
        + 'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RV 0 S 0 2 0.5 RT '
        + 'SIH 0 4 SSSP 0 4 M 0 1 S 0 1 0.6 RT '
        + 'SIH 0 4 SSSP 0 4',
        'M 0 0 L 10 10 L 20 20 L 30 30 L 35 35 M 35 35 L 40 40 L 50 50',
      ),
      makeTest(
        'M 50 50 L 40 40 L 39 39 L 38 38 L 35 35 M 0 0 L 10 10 L 20 20 L 30 30 L 35 35',
        'SSSP 0 3',
        'M 50 50 L 40 40 L 39 39 L 38 38 M 38 38 L 35 35 M 0 0 L 10 10 L 20 20 L 30 30 L 35 35',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2',
        'M 30 30 L 20 20 L 10 10 M 10 10 L 0 0',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 USSSP 0',
        'M 30 30 L 20 20 L 10 10 L 0 0',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 USSSP 1',
        'M 30 30 L 20 20 L 10 10 L 0 0',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 RV 1',
        'M 30 30 L 20 20 L 10 10 M 0 0 L 10 10',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 RV 0 RV 1',
        'M 10 10 L 20 20 L 30 30 M 0 0 L 10 10',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 RV 0 RV 1 S 1 1 0.7',
        'M 10 10 L 20 20 L 30 30 M 0 0 L 7 7 L 10 10',
      ),
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'RV 0 SSSP 0 2 RV 0 RV 1 S 1 1 0.7',
        'M 10 10 L 20 20 L 30 30 M 0 0 L 7 7 L 10 10',
      ),
      // Deleting nonexistent collapsing subpaths after splitting a stroked subpath has no effect.
      makeTest(
        'M 0 0 L 10 10 L 20 20 L 30 30',
        'SSSP 0 2 AC 5 5 5 DC DC',
        'M 0 0 L 10 10 L 20 20 M 20 20 L 30 30',
      ),
      makeTest(
        'M 0 0 L 1 1 L 2 2',
        'RV 0 S 0 2 0.8 S 0 2 0.25 S 0 3 0.75 SSSP 0 3',
        'M 2 2 L 1 1 L 0.8 0.8 L 0.35 0.35 M 0.35 0.35 L 0.2 0.2 L 0 0',
      ),
      makeTest(
        'M 7 8 C 7 2 16 2 16 8 C 16 10 14 12 12 14',
        'RV 0 SIH 0 2 SSSP 0 2',
        'M 12 14 C 14 12 16 10 16 8 C 16 5 13.75 3.5 11.5 3.5 M 11.5 3.5 C 9.25 3.5 7 5 7 8',
      ),
      makeTest(
        'M 7 8 C 7 2 16 2 16 8 C 16 10 14 12 12 14',
        'RV 0 SIH 0 2 SSSP 0 2 RT',
        'M 7 8 C 7 2 16 2 16 8 C 16 10 14 12 12 14',
      ),
      makeTest(
        'M 1 1 L 2 1 L 2 2 M 5 5 L 5 10 L 10 10 L 10 5 L 5 5',
        'RV 1 SF 1 SIH 1 2 SSSP 1 2',
        'M 1 1 L 2 1 L 2 2 M 10 5 L 10 10 L 7.5 10 M 7.5 10 L 5 10 L 5 5 L 10 5',
      ),
      // Split/unsplit filled sub paths.
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 SFSP 0 1 3',
        'M 8 5 L 8 12 L 19 12 L 8 5 M 8 12 L 8 19 L 19 12 L 8 12',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 SFSP 0 3 1',
        'M 8 5 L 8 12 L 19 12 L 8 5 M 8 12 L 8 19 L 19 12 L 8 12',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 SIH 0 4 SFSP 0 1 4',
        'M 8 5 L 8 12 L 13.5 8.5 L 8 5 M 8 12 L 8 19 L 19 12 L 13.5 8.5 L 8 12',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 Z',
        'SIH 0 1 SIH 0 4 SFSP 0 1 4',
        'M 8 5 L 8 12 L 13.5 8.5 L 8 5 M 8 12 L 8 19 L 19 12 L 13.5 8.5 L 8 12',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 Z',
        'AC 5 5 1 S 0 1 0.4 S 0 4 0.6 SFSP 0 1 4 UCV 0 UCV 1 UCV 2 DC',
        'M 8 5 L 8 10.6 L 12.4 7.8 L 8 5 M 8 10.6 L 8 19 L 19 12 L 12.4 7.8 L 8 10.6',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 SFSP 0 1 3 S 0 3 0.4',
        `M 8 5 L 8 12 L 19 12 L ${lerp(19, 8, 0.4)} ${lerp(12, 5, 0.4)} L 8 5 M 8 12 L 8 19 L 19 12 L 8 12`,
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 S 0 3 1 SFSP 0 1 3',
        'M 8 5 L 8 12 L 19 12 L 19 12 L 8 5 M 8 12 L 8 19 L 19 12 L 8 12',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 1 S 0 3 1 SFSP 0 1 3',
        'M 8 5 L 8 12 L 19 12 L 19 12 L 8 5 M 8 12 L 8 19 L 19 12 L 8 12',
      ),
      makeTest(
        'M0 0L0 0v10h10v-10h-10',
        'SFSP 0 1 3',
        'M 0 0 L 0 0 L 10 10 L 10 0 L 0 0 M 0 0 L 0 10 L 10 10 L 0 0',
      ),
      makeTest(
        'M0 0L0 0v10h10v-10h-10',
        'SFSP 0 1 3 USFSP 0',
        'M0 0L0 0v10h10v-10h-10',
      ),
      makeTest(
        'M0 0L0 0v10h10v-10h-10',
        'SFSP 0 1 3 SF 1 RV 1 USFSP 0',
        'M0 0L0 0v10h10v-10h-10',
      ),
      makeTest(
        'M0 0L0 0v10h10v-10h-10',
        'SFSP 0 1 3 RV 0 SF 1 SF 1 USFSP 1',
        'M0 0L0 0v10h10v-10h-10',
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4',
        'M 0 0 L 0 5 L 10 5 L 10 0 L 0 0 M 0 5 L 0 10 L 10 10 L 10 5 L 0 5'
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 SIH 1 4 SIH 1 2 SFSP 1 2 5',
        'M 0 0 L 0 5 L 10 5 L 10 0 L 0 0 M 0 5 L 0 10 L 5 10 L 5 5 L 0 5 M 5 10 L 10 10 L 10 5 L 5 5 L 5 10'
      ),
      // Delete sub path split segment.
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 DSPSS 0 2',
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0'
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 DSPSS 1 4',
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0'
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 SIH 1 4 SIH 1 2 SFSP 1 2 5 DSPSS 1 3',
        'M 0 0 L 0 5 L 10 5 L 10 0 L 0 0 M 0 5 L 0 10 L 10 10 L 10 5 L 0 5'
      ),
      makeTest(
        'M 0 0 L 0 10 L 10 10 L 10 0 L 0 0',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 SIH 1 4 SIH 1 2 SFSP 1 2 5 DSPSS 2 4',
        'M 0 0 L 0 5 L 10 5 L 10 0 L 0 0 M 0 5 L 0 10 L 10 10 L 10 5 L 0 5'
      ),
      makeTest(
        'M 0 0 L 0 15 L 15 15 L 15 0 L 0 0',
        `S 0 3 ${2 / 3} S 0 3 0.5 S 0 1 ${2 / 3} S 0 1 0.5 SFSP 0 1 6`,
        `M 0 0 L 0 5 L 15 5 L 15 0 L 0 0 M 0 5 L 0 10 L 0 15 L 15 15 L 15 10 L 15 5 L 0 5`
      ),
      makeTest(
        'M 0 0 L 0 15 L 15 15 L 15 0 L 0 0',
        `S 0 3 ${2 / 3} S 0 3 0.5 S 0 1 ${2 / 3} S 0 1 0.5 SFSP 0 1 6 SFSP 1 1 4`,
        `M 0 0 L 0 5 L 15 5 L 15 0 L 0 0 M 0 5 L 0 10 L 15 10 L 15 5 L 0 5 M 0 10 L 0 15 L 15 15 L 15 10 L 0 10`
      ),
      makeTest(
        'M 0 0 L 0 15 L 15 15 L 15 0 L 0 0',
        `S 0 3 ${2 / 3} S 0 3 0.5 S 0 1 ${2 / 3} S 0 1 0.5 SFSP 0 1 6 SFSP 1 1 4 DSPSS 1 2`,
        `M 0 0 L 0 5 L 15 5 L 15 0 L 0 0 M 0 5 L 0 15 L 15 15 L 15 5 L 0 5`
      ),
      makeTest(
        'M 0 0 L 0 15 L 15 15 L 15 0 L 0 0',
        `S 0 3 ${2 / 3} S 0 3 0.5 S 0 1 ${2 / 3} S 0 1 0.5 SFSP 0 1 6 SFSP 1 1 4 DSPSS 2 4`,
        `M 0 0 L 0 5 L 15 5 L 15 0 L 0 0 M 0 5 L 0 15 L 15 15 L 15 5 L 0 5`
      ),
      makeTest(
        'M 18 19 L 18 5 L 14 5 L 14 19 L 18 19',
        'S 0 3 0.5 S 0 1 0.5 SFSP 0 1 4',
        'M 18 19 L 18 12 L 14 12 L 14 19 L 18 19 M 18 12 L 18 5 L 14 5 L 14 12 L 18 12',
      ),
      makeTest(
        'M 18 19 L 18 5 L 14 5 L 14 19 L 18 19 M 10 19 L 10 5 L 6 5 L 6 19 L 10 19',
        'S 0 3 0.5 S 0 1 0.5 SFSP 0 1 4',
        'M 18 19 L 18 12 L 14 12 L 14 19 L 18 19 M 18 12 L 18 5 L 14 5 L 14 12 L 18 12 M 10 19 L 10 5 L 6 5 L 6 19 L 10 19',
      ),
      makeTest(
        'M 8 5 L 8 19 L 19 12 L 8 5',
        'SIH 0 3 SIH 0 1 SFSP 0 1 4 SB 0 SB 0 SIH 0 2 SIH 0 1 SFSP 0 1 3 RT',
        'M 8 5 L 8 19 L 19 12 L 8 5',
      ),
      makeTest(
        'M 0 0 h 20 v 20 h -20 v -20',
        'S 0 3 0.75 S 0 1 0.25 SFSP 0 1 4 S 1 3 0.5 S 1 1 0.5 SFSP 1 1 4',
        'M 0 0 L 5 0 L 5 20 L 0 20 L 0 0 M 5 0 L 12.5 0 L 12.5 20 L 5 20 L 5 0 M 12.5 0 L 20 0 L 20 20 L 12.5 20 L 12.5 0',
      ),
      makeTest(
        'M 0 0 h 20 v 20 h -20 v -20',
        'S 0 3 0.75 S 0 1 0.25 SFSP 0 1 4 S 1 3 0.5 S 1 1 0.5 SFSP 1 1 4 DSPSS 1 2',
        'M 0 0 L 5 0 L 5 20 L 0 20 L 0 0 M 5 0 L 20 0 L 20 20 L 5 20 L 5 0',
      ),
      makeTest(
        'M 0 0 h 20 v 20 h -20 v -20',
        'S 0 3 0.75 S 0 1 0.25 SFSP 0 1 4 S 1 3 0.5 S 1 1 0.5 SFSP 1 1 4 DSPSS 2 4',
        'M 0 0 L 5 0 L 5 20 L 0 20 L 0 0 M 5 0 L 20 0 L 20 20 L 5 20 L 5 0',
      ),
      makeTest(
        'M 4 4 h 20 v 20 h -20 v -20',
        `SIH 0 3 SIH 0 1 SFSP 0 1 4 S 1 4 0.625 S 1 1 0.75 SFSP 1 1 5 SIH 1 3 SIH 1 2 SFSP 1 2 4 DSPSS 3 4`,
        'M 4 4 h 20 v 20 h -20 v -20',
      ),
      // TODO: add tests for shift offsets w/ split sub paths
      // TODO: add more tests for compound paths w/ split sub paths
      // TODO: better tests for multiple transforms at a time
      // TODO: test that reversals and shifts still work after transforms
      // TODO: test that splits and conversions and stuff still work after transforms
      // TODO: test that reversals/shifts/splits/etc. are reverted properly, not just transforms
    ];

    for (const test of MUTATION_TESTS) {
      it(`[${test.ops}] '${test.actual}' → '${test.expected}'`, () => {
        checkPathsEqual(mutatePath(test.actual, test.ops), newPath(test.expected));
      });
    }
  });

  describe('assigning subpath IDs', () => {
    const SUBPATH_ID_TESTS = [
      { desc: 'id set on single-subpath path', path: 'M 0 0 L 0 0 L 0 0 L 0 0 L 0 0 L 0 0', expected: 1 },
      { desc: 'id set on two-subpath path', path: 'M 0 0 L 0 0 M 0 0 L 0 0 L 0 0 L 0 0', expected: 2 },
      { desc: 'id set on three-subpath path', path: 'M 0 0 L 0 0 M 0 0 L 0 0 M 0 0 L 0 0', expected: 3 },
    ];

    const countUniqueSubPathIdsFn = (pathString: string) => {
      return new Set(newPath(pathString).getSubPaths().map(s => s.getId())).size;
    };

    for (const test of SUBPATH_ID_TESTS) {
      it(test.desc, () => {
        expect(countUniqueSubPathIdsFn(test.path)).toEqual(test.expected);
      });
    }

    it('subpath IDs persist correctly after mutations', () => {
      const path = newPath('M 0 0 L 0 0 M 0 0 L 0 0 M 0 0 L 0 0');
      const subPathIds = path.getSubPaths().map(s => s.getId());
      const updatedPath = path.mutate().moveSubPath(0, 1).build();
      const updatedSubPathIds = updatedPath.getSubPaths().map(s => s.getId());
      expect(updatedSubPathIds).toEqual([subPathIds[1], subPathIds[0], subPathIds[2]]);
      const revertedPath = updatedPath.mutate().revert().build();
      const revertedSubPathIds = revertedPath.getSubPaths().map(s => s.getId());
      expect(revertedSubPathIds).toEqual(subPathIds);
    });
  });

  // TODO: add more projection tests for split subpaths
  describe('#project', () => {
    const TESTS_PROJECT: Array<{ point: Point, path: string | Path, proj: ProjectionOntoPath, subIdx?: number }> = [
      {
        point: new Point(5, 5),
        path: 'M 0 0 L 10 10',
        proj: { subIdx: 0, cmdIdx: 1, projection: { x: 5, y: 5, d: 0, t: 0.5 } },
      },
      {
        point: new Point(24, 12),
        path: mutatePath('M 8 5 L 8 19 L 19 12 Z', 'SIH 0 2 S 0 1 0.5 SFSP 0 1 4 US 1 2'),
        proj: { subIdx: 0, cmdIdx: 2, projection: { x: 19, y: 12, d: 5, t: 1 } },
      },
      {
        point: new Point(7, 16.9),
        path: mutatePath('M 8 5 L 8 19 L 19 12 Z', 'S 0 1 0.5 SFSP 0 1 3'),
        proj: { subIdx: 1, cmdIdx: 1, projection: { x: 8, y: 16.9, d: 1, t: 0.7 } },
      },
      {
        point: new Point(3, 12),
        path: 'M 18 19 18 15 14 5 14 19 18 19 M 10 19 10 5 6 5 6 19 10 19',
        proj: { subIdx: 1, cmdIdx: 3, projection: { x: 6, y: 12, d: 3, t: 0.5 } },
      },
      {
        point: new Point(3, 12),
        path: 'M 18 19 18 15 14 5 14 19 18 19 M 10 19 10 5 6 5 6 19 10 19',
        proj: { subIdx: 1, cmdIdx: 3, projection: { x: 6, y: 12, d: 3, t: 0.5 } },
        subIdx: 1,
      },
      {
        point: new Point(21, 12),
        path: 'M 18 19 18 15 14 5 14 19 18 19 M 10 19 10 5 6 5 6 19 10 19',
        proj: { subIdx: 1, cmdIdx: 1, projection: { x: 10, y: 12, d: 11, t: 0.5 } },
        subIdx: 1,
      },
      {
        point: new Point(4, 12),
        path: 'M 20 22 L 4 22 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z',
        proj: { subIdx: 0, cmdIdx: 2, projection: { x: 4, y: 12, d: 0, t: 0.5 } },
      }
    ];

    TESTS_PROJECT.forEach(a => {
      const point = a.point as Point;
      const path = (typeof a.path === 'string') ? newPath(a.path) : a.path;
      it(`projecting '(${point.x},${point.y})' onto '${path.getPathString()}' yields ${JSON.stringify(a.proj)}`, () => {
        const result = path.project(point, a.subIdx);
        result.projection.t = _.round(result.projection.t, 10);
        expect(result).toEqual(a.proj as ProjectionOntoPath);
      });
    });
  });

  // TODO: add more projection tests for split subpaths
  describe('#hitTest', () => {
    const TESTS_HIT_TEST_FILL = [
      [new Point(5, 5), 'M4 4h2v2h-2v-2', true],
      [new Point(5, 5), 'M4 4Q 5 4 6 4 Q6 5 6 6 Q5 6 4 6 Q4 5 4 4', true],
      [new Point(16, 7), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', true],
      [new Point(16, 12), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', true],
      [new Point(16, 17), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', true],
      [new Point(0, 0), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(0, 12), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(12, 12), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(12, 0), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(24, 24), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(19, 20), 'M6 19h4V5H6v14zm8-14v14h4V5h-4z', false],
      [new Point(14, 10), mutatePath('M8 5L8 19L19 12L8 5', 'SIH 0 1 SFSP 0 1 3'), true],
      [new Point(17, 6), mutatePath('M8 5L8 19L19 12L8 5', 'SIH 0 1 SFSP 0 1 3'), false],
      [new Point(11, 9), mutatePath('M8 5L8 19L19 12L8 5', 'SIH 0 1 SFSP 0 1 3'), true],
      [new Point(11, 9), mutatePath('M8 5L8 19L19 12L8 5', 'SIH 0 1 S 0 3 1 SFSP 0 1 3'), true],
    ];

    const TESTS_HIT_TEST_STROKE = [
      [new Point(4, 12), 'M 20 22 L 4 22 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z', 1, true],
      [new Point(2, 12), 'M 20 22 L 4 22 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z', 1, false],
      [new Point(6, 16), 'M 20 22 L 4 22 L 4 2 L 6 2 L 6 14 L 8 14 L 8 2 L 10 2 L 10 14 Z', 1, false],
    ];

    TESTS_HIT_TEST_FILL.forEach(a => {
      const point = a[0] as Point;
      const path = (typeof a[1] === 'string') ? newPath(a[1] as string) : a[1] as Path;
      it(`hit test for '(${point.x},${point.y})' on fill path '${a[1]}' yields '${a[2]}'`, () => {
        expect(path.hitTest(point, { findShapesInRange: true }).isShapeHit).toEqual(a[2] as boolean);
      });
    });

    TESTS_HIT_TEST_STROKE.forEach(a => {
      const point = a[0] as Point;
      const path = newPath(a[1] as string);
      it(`hit test for '(${point.x},${point.y})' on stroke path '${a[1]}' yields '${a[3]}'`, () => {
        const hitResult = path.hitTest(point, {
          isSegmentInRangeFn: dist => {
            return dist < a[2];
          }
        });
        expect(hitResult.isSegmentHit).toEqual(a[3] as boolean);
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

