import { Path, SvgChar } from 'app/model/paths';
import { Matrix } from 'app/scripts/common';

type PathOp =
  | 'RV'
  | 'SB'
  | 'SF'
  | 'S'
  | 'SIH'
  | 'US'
  | 'CV'
  | 'UCV'
  | 'RT'
  | 'M'
  | 'AC'
  | 'DC'
  | 'SSSP'
  | 'SFSP'
  | 'DFSP'
  | 'DFSPS'
  | 'DSSP'
  | 'T';

export function fromPathOpString(pathString: string, pathOpsString: string) {
  const A = pathOpsString.split(' ');
  const mutator = new Path(pathString).mutate();
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
        mutator.addCollapsingSubPath({ x: +A[i + 1], y: +A[i + 2] }, +A[i + 3]);
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
      case 'DFSP': // Delete filled sub path.
        mutator.deleteFilledSubPath(+A[i + 1]);
        i += 1;
        break;
      case 'DFSPS': // Delete filled subpath segment.
        mutator.deleteFilledSubPathSegment(+A[i + 1], +A[i + 2]);
        i += 2;
        break;
      case 'DSSP': // Delete stroked sub path.
        mutator.deleteStrokedSubPath(+A[i + 1]);
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
              matrix = Matrix.scaling(+A[i + 2], +A[i + 3]);
              i += 3;
              break;
            case 'rotate':
              matrix = Matrix.rotation(+A[i + 2]);
              i += 2;
              break;
            case 'translate':
              matrix = Matrix.translation(+A[i + 2], +A[i + 3]);
              i += 3;
              break;
            default:
              throw new Error('Invalid transform op: ' + transformOp);
          }
          mutator.transform(matrix);
        }
        break;
      default:
        throw new Error('Invalid path op: ' + op);
    }
  }
  return mutator.build();
}
