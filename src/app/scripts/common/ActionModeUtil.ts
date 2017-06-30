import { ActionSource } from 'app/model/actionmode';
import { PathAnimationBlock } from 'app/model/timeline';

interface Result {
  // True iff the paths are compatible.
  readonly areCompatible: boolean;
  // If the paths are incompatible, this is the path that the user should add points to.
  readonly errorPath?: ActionSource;
  // If the paths are incompatible, then the subpath at index 'subIdx'...
  readonly errorSubIdx?: number;
  // ...is missing 'numPointsMissing' points.
  readonly numPointsMissing?: number;
}

export function checkPathsCompatible(block: PathAnimationBlock): Result {
  const { fromValue, toValue } = block;
  if (block.isAnimatable()) {
    return { areCompatible: true };
  }

  const numFromSubPaths = fromValue.getSubPaths().length;
  const numToSubPaths = toValue.getSubPaths().length;
  if (numFromSubPaths !== numToSubPaths) {
    // This should never happen in the app (since collapsing subpaths will
    // be added before this can occur).
    return { areCompatible: false };
  }
  for (let i = 0; i < numFromSubPaths; i++) {
    const fromCmds = fromValue.getSubPath(i).getCommands();
    const toCmds = toValue.getSubPath(i).getCommands();
    if (fromCmds.length === toCmds.length) {
      continue;
    }
    const errorSubIdx = i;
    const errorPath = fromCmds.length < toCmds.length ? ActionSource.From : ActionSource.To;
    const numPointsMissing = Math.abs(fromCmds.length - toCmds.length);
    return { areCompatible: false, errorPath, errorSubIdx, numPointsMissing };
  }

  // This should never happen.
  return { areCompatible: false };
}
