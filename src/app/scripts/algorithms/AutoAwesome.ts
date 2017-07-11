import { Command, Path, PathUtil } from 'app/model/paths';
import { MathUtil, Point } from 'app/scripts/common';
import * as _ from 'lodash';

import { separate } from './Multiple';

// POSSIBLE IMPROVEMENTS
//
// - Add additional points to both shapes first such that every segment longer than
//   a certain distance is bisected. This may help reduce a bit of noise during alignment.
// - Tweaking the placement of added points with simulated annealing.
// - Using a cost function that factors in self-intersections at the halfway mark in
//   addition to distance traveled.
// - Use triangulation and/or Volonoi topology diagram in order to more accurately morph
//   between SVGs with differing numbers of subpaths.
//
// Useful links/examples:
// - Triangulation: https://goo.gl/Ug2pj9
// - Jigsaw morphing: https://goo.gl/Za3akJ
// - Voronoi topology: https://goo.gl/VNM7Tb
// - Smoother polygon transitions: https://goo.gl/5njTsf
// - Redistricting: https://goo.gl/sMkYEM

// Needleman-Wunsch scoring function constants.
const MATCH = 1;
const MISMATCH = -1;
const INDEL = 0;

export function fix(fromPath: Path, toPath: Path) {
  const interpolator = separate(
    fromPath.getPathString(),
    toPath.getSubPaths().map(s => new Path(s.getCommands().slice()).getPathString()),
    { single: true },
  ) as (t: number) => string;
  return { from: new Path(interpolator(0)), to: new Path(interpolator(1)) };
}

/**
 * Takes two arbitrary paths, calculates a best-estimate alignment of the two,
 * and then inserts no-op commands into the alignment gaps to make the two paths
 * compatible with each other.
 *
 * TODO: this can still be optimized a lot... work in progress!
 */
export function autoFix(resultStartPath: Path, resultEndPath: Path) {
  const numSubPaths = Math.min(
    resultStartPath.getSubPaths().length,
    resultEndPath.getSubPaths().length,
  );
  for (let subIdx = 0; subIdx < numSubPaths; subIdx++) {
    // Pass the command with the larger subpath as the 'from' command.
    const numStartCmds = resultStartPath.getSubPath(subIdx).getCommands().length;
    const numEndCmds = resultEndPath.getSubPath(subIdx).getCommands().length;
    const fromCmd = numStartCmds >= numEndCmds ? resultStartPath : resultEndPath;
    const toCmd = numStartCmds >= numEndCmds ? resultEndPath : resultStartPath;
    const { from, to } = autoFixInternal(subIdx, fromCmd, toCmd);
    resultStartPath = numStartCmds >= numEndCmds ? from : to;
    resultEndPath = numStartCmds >= numEndCmds ? to : from;
  }
  return {
    from: resultStartPath,
    to: resultEndPath,
  };
}

function autoFixInternal(subIdx: number, srcFromPath: Path, srcToPath: Path) {
  // Create and return a list of reversed and shifted paths to test.
  // TODO: can this be optimized? (this essentially brute-forces all possible permutations)
  const createFromCmdGroupsFn = (...paths: Path[]): Path[] => {
    const fromPathList: Path[] = [];
    for (const p of paths) {
      fromPathList.push(p);
      if (!p.getSubPath(subIdx).isClosed()) {
        continue;
      }
      const numFromCmds = p.getSubPaths()[subIdx].getCommands().length;
      for (let i = 1; i < numFromCmds - 1; i++) {
        fromPathList.push(p.mutate().shiftSubPathBack(subIdx, i).build());
      }
    }
    return fromPathList;
  };

  // TODO: experiment with this... need to test this more
  // Approximate the centers of the start and end subpaths. We'll use this information
  // to achieve a more accurate alignment score.
  // const fromCenter = srcFromPath.getPoleOfInaccessibility(subIdx);
  // const toCenter = srcToPath.getPoleOfInaccessibility(subIdx);
  // const centerOffset = new Point(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y);

  // The scoring function to use to calculate the alignment. Convert-able
  // commands are considered matches. However, the farther away the points
  // are from each other, the lower the score.
  const getScoreFn = (cmdA: Command, cmdB: Command) => {
    if (
      cmdA.getSvgChar() !== cmdB.getSvgChar() &&
      !cmdA.canConvertTo(cmdB.getSvgChar()) &&
      !cmdB.canConvertTo(cmdA.getSvgChar())
    ) {
      return MISMATCH;
    }
    const { x, y } = cmdA.getEnd();
    // TODO: experiment with this... need to test this more
    // const start = new Point(x + centerOffset.x, y + centerOffset.y);
    const start = new Point(x, y);
    const end = cmdB.getEnd();
    const distance = Math.max(MATCH, MathUtil.distance(start, end));
    return 1 / distance;
  };

  // Align each generated 'from path' with the target 'to path'.
  const fromPaths = createFromCmdGroupsFn(
    srcFromPath,
    srcFromPath.mutate().reverseSubPath(subIdx).build(),
  );
  const alignmentInfos = fromPaths.map(generatedFromPath => {
    const fromCmds = generatedFromPath.getSubPaths()[subIdx].getCommands();
    const toCmds = srcToPath.getSubPaths()[subIdx].getCommands();
    return { generatedFromPath, alignment: align(fromCmds, toCmds, getScoreFn) };
  });

  // Find the alignment with the highest score.
  const alignmentInfo = alignmentInfos.reduce((prev, curr) => {
    const prevScore = prev.alignment.score;
    const currScore = curr.alignment.score;
    return prevScore > currScore ? prev : curr;
  });

  // For each alignment, determine whether it and its neighbor is a gap.
  interface CmdInfo {
    isGap: boolean;
    isNextGap: boolean;
    nextCmdIdx: number;
  }
  const processAlignmentsFn = (alignments: Alignment<Command>[]) => {
    let nextCmdIdx = 0;
    return alignments.map((alignment, i) => {
      const isGap = !alignment.obj;
      const isNextGap = i + 1 < alignments.length && !alignments[i + 1].obj;
      if (!isGap) {
        nextCmdIdx++;
      }
      return { isGap, isNextGap, nextCmdIdx } as CmdInfo;
    });
  };

  const fromCmdInfos = processAlignmentsFn(alignmentInfo.alignment.from);
  const toCmdInfos = processAlignmentsFn(alignmentInfo.alignment.to);

  // Process each list of alignments. Each streak of gaps represents a series
  // of one or more splits we'll perform on the path.
  const createGapStreaksFn = (cmdInfos: CmdInfo[]) => {
    const gapStreaks: CmdInfo[][] = [];
    let currentGapStreak = [];
    for (const cmdInfo of cmdInfos) {
      if (cmdInfo.isGap) {
        currentGapStreak.push(cmdInfo);
        if (!cmdInfo.isNextGap) {
          gapStreaks.push(currentGapStreak);
          currentGapStreak = [];
        }
      }
    }
    return gapStreaks;
  };
  const fromGapGroups = createGapStreaksFn(fromCmdInfos);
  const toGapGroups = createGapStreaksFn(toCmdInfos);

  // Fill in the gaps by applying linear subdivide batch splits.
  const applySplitsFn = (path: Path, gapGroups: CmdInfo[][]) => {
    const splitOps: { subIdx: number; cmdIdx: number; ts: number[] }[] = [];
    const numPaths = path.getSubPaths()[subIdx].getCommands().length;
    for (let i = gapGroups.length - 1; i >= 0; i--) {
      const gapGroup = gapGroups[i];
      // Clamp the index between 1 and numCommands - 1 to account for cases
      // where the alignment algorithm attempts to append new commands to the
      // front and back of the sequence.
      const cmdIdx = MathUtil.clamp(_.last(gapGroup).nextCmdIdx, 1, numPaths - 1);
      const ts = gapGroup.map((unused, gapIdx) => (gapIdx + 1) / (gapGroup.length + 1));
      splitOps.push({ subIdx, cmdIdx, ts });
    }
    PathUtil.sortPathOps(splitOps);
    const mutator = path.mutate();
    for (const { cmdIdx, ts } of splitOps) {
      mutator.splitCommand(subIdx, cmdIdx, ...ts);
    }
    return mutator.build();
  };

  const fromPathResult = applySplitsFn(alignmentInfo.generatedFromPath, fromGapGroups);
  const toPathResult = applySplitsFn(srcToPath, toGapGroups);

  // Finally, convert the commands before returning the result.
  return autoConvert(subIdx, fromPathResult, toPathResult);
}

/**
 * Takes two paths with an equal number of commands and makes them compatible
 * by converting each pair one-by-one.
 */
export function autoConvert(subIdx: number, srcFromPath: Path, srcToPath: Path) {
  const fromCmds = srcFromPath.getSubPaths()[subIdx].getCommands();
  const toCmds = srcToPath.getSubPaths()[subIdx].getCommands();
  const fromMutator = srcFromPath.mutate();
  const toMutator = srcToPath.mutate();
  fromCmds.forEach((fromCmd, cmdIdx) => {
    const toCmd = toCmds[cmdIdx];
    if (fromCmd.getSvgChar() === toCmd.getSvgChar()) {
      return;
    }
    if (fromCmd.canConvertTo(toCmd.getSvgChar())) {
      fromMutator.convertCommand(subIdx, cmdIdx, toCmd.getSvgChar());
    } else if (toCmd.canConvertTo(fromCmd.getSvgChar())) {
      toMutator.convertCommand(subIdx, cmdIdx, fromCmd.getSvgChar());
    }
  });
  return { from: fromMutator.build(), to: toMutator.build() };
}

/** Represents either a valid object or an empty gap slot. */
interface Alignment<T> {
  obj?: T;
}

/**
 * Aligns two sequences of objects using the Needleman-Wunsch algorithm.
 */
function align<T>(
  from: ReadonlyArray<T>,
  to: ReadonlyArray<T>,
  scoringFunction: (t1: T, t2: T) => number,
) {
  const listA: Alignment<T>[] = from.map(obj => ({ obj }));
  const listB: Alignment<T>[] = to.map(obj => ({ obj }));
  const alignedListA: Alignment<T>[] = [];
  const alignedListB: Alignment<T>[] = [];

  // Add dummy nodes at the first position of each list.
  listA.unshift(undefined);
  listB.unshift(undefined);

  let i: number, j: number;

  // Initialize the scoring matrix.
  const matrix: number[][] = [];
  for (i = 0; i < listA.length; i++) {
    const row = [];
    for (j = 0; j < listB.length; j++) {
      row.push(i === 0 ? -j : j === 0 ? -i : 0);
    }
    matrix.push(row);
  }

  // Process the scoring matrix.
  for (i = 1; i < listA.length; i++) {
    for (j = 1; j < listB.length; j++) {
      const match = matrix[i - 1][j - 1] + scoringFunction(listA[i].obj, listB[j].obj);
      const ins = matrix[i][j - 1] + INDEL;
      const del = matrix[i - 1][j] + INDEL;
      matrix[i][j] = Math.max(match, ins, del);
    }
  }

  // Backtracking.
  i = listA.length - 1;
  j = listB.length - 1;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      matrix[i][j] === matrix[i - 1][j - 1] + scoringFunction(listA[i].obj, listB[j].obj)
    ) {
      alignedListA.unshift(listA[i--]);
      alignedListB.unshift(listB[j--]);
    } else if (i > 0 && matrix[i][j] === matrix[i - 1][j] + INDEL) {
      alignedListA.unshift(listA[i--]);
      alignedListB.unshift({});
    } else {
      alignedListA.unshift({});
      alignedListB.unshift(listB[j--]);
    }
  }

  return {
    from: alignedListA,
    to: alignedListB,
    score: _.last(_.last(matrix)),
  };
}
