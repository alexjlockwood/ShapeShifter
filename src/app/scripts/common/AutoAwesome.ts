import * as _ from 'lodash';
import { PathCommand, SubPathCommand, Command } from '../model';
import { MathUtil } from '.';

// Needleman-Wunsch scoring function constants.
const MATCH = 1;
const MISMATCH = -1;
const INDEL = 0;

// TODO: this can still be optimized a lot... work in progress!
export function fix(
  subPathIdx: number,
  srcFromPath: PathCommand,
  srcToPath: PathCommand) {

  // Create and return a list of reversed and shifted path commands to test.
  const createFromCmdGroupsFn = (...pathCommands: PathCommand[]): PathCommand[] => {
    const fromPaths = [];
    for (const p of pathCommands) {
      const numFromCmds = p.subPathCommands[subPathIdx].commands.length;
      for (let i = 0; i < numFromCmds - 1; i++) {
        fromPaths.push(p.shiftBack(subPathIdx, i));
      }
    }
    return fromPaths;
  };

  // The scoring function to use to calculate the alignment. Convert-able
  // commands are considered matches. However, the farther away the points
  // are from each other, the lower the score.
  const getScoreFn = (cmdA: Command, cmdB: Command) => {
    if (cmdA.svgChar !== cmdB.svgChar
      && !cmdA.canConvertTo(cmdB.svgChar)
      && !cmdB.canConvertTo(cmdA.svgChar)) {
      return MISMATCH;
    }
    // TODO: if we are going to use distance as part of the scoring function,
    // the value should be dependent on the SVG's viewport width/height.
    const distance = Math.max(MATCH, MathUtil.distance(cmdA.end, cmdB.end));
    return 1 / distance;
  };

  // Align each generated 'from path' with the target 'to path'.
  const fromPaths =
    createFromCmdGroupsFn(srcFromPath, srcFromPath.reverse(subPathIdx));
  const alignmentInfos = fromPaths.map(generatedFromPath => {
    const fromCmds = generatedFromPath.subPathCommands[subPathIdx].commands;
    const toCmds = srcToPath.subPathCommands[subPathIdx].commands;
    return { generatedFromPath, alignment: align(fromCmds, toCmds, getScoreFn) };
  });

  // Find the alignment with the highest score.
  const alignmentInfo = alignmentInfos.reduce((prev, curr) => {
    const prevScore = prev.alignment.score;
    const currScore = curr.alignment.score;
    return prevScore > currScore ? prev : curr;
  });

  // For each alignment, determine whether it and its neighbor is a gap.
  interface CmdInfo { isGap: boolean; isNextGap: boolean; nextDrawIdx: number; }
  const processAlignmentsFn = (alignments: Alignment<Command>[]) => {
    let nextDrawIdx = 0;
    return alignments.map((alignment, i) => {
      const isGap = !alignment.obj;
      const isNextGap = (i + 1 < alignments.length) && !alignments[i + 1].obj;
      if (!isGap) {
        nextDrawIdx++;
      }
      return { isGap, isNextGap, nextDrawIdx } as CmdInfo;
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

  // Finally, fill in the gaps by applying batch splits.
  const applySplitsFn = (pathCommand: PathCommand, gapGroups: CmdInfo[][]) => {
    for (let i = gapGroups.length - 1; i >= 0; i--) {
      const gapGroup = gapGroups[i];
      const drawIdx = _.last(gapGroup).nextDrawIdx;
      const ts = [];
      for (let j = gapGroup.length - 1; j >= 0; j--) {
        const t = (j + 1) / (gapGroup.length + 1);
        ts.push(t);
        // TODO: perform these splits as a single batch operation
        // pathCommand = pathCommand.split(subPathIdx, drawIdx, t);
      }
      pathCommand = pathCommand.split(subPathIdx, drawIdx, ...ts);
    }
    return pathCommand;
  };

  const fromPathResult = applySplitsFn(alignmentInfo.generatedFromPath, fromGapGroups);
  const toPathResult = applySplitsFn(srcToPath, toGapGroups);

  const convertDrawCmdsFn = (from: PathCommand, to: PathCommand) => {
    const fromDrawCmds = from.subPathCommands[subPathIdx].commands;
    const toDrawCmds = to.subPathCommands[subPathIdx].commands;
    fromDrawCmds.forEach((fromDrawCmd, drawIdx) => {
      const toDrawCmd = toDrawCmds[drawIdx];
      if (fromDrawCmd.svgChar === toDrawCmd.svgChar
        || !fromDrawCmd.canConvertTo(toDrawCmd.svgChar)) {
        return;
      }
      // TODO: perform these conversions as a single batch operation
      from = from.convert(subPathIdx, drawIdx, toDrawCmd.svgChar);
    });
    return from;
  };

  const toPathFinalResult = convertDrawCmdsFn(toPathResult, fromPathResult);
  const fromPathFinalResult = convertDrawCmdsFn(fromPathResult, toPathFinalResult);

  return {
    from: fromPathFinalResult,
    to: toPathFinalResult,
  };
}

/** Represents either a valid object or an empty gap slot. */
interface Alignment<T> {
  obj?: T;
}

/**
 * Aligns two sequences of draw commands using the Needleman-Wunsch algorithm.
 * TODO: make this generic to any object type (not just draw commands)
 */
function align<T>(
  from: ReadonlyArray<T>,
  to: ReadonlyArray<T>,
  scoringFunction: (t1: T, t2: T) => number) {

  const listA: Alignment<T>[] = from.map(obj => { return { obj }; });
  const listB: Alignment<T>[] = to.map(obj => { return { obj }; });
  const originalListA = from;
  const originalListB = to;
  const alignedListA: Alignment<T>[] = [];
  const alignedListB: Alignment<T>[] = [];

  // Add dummy nodes at the first position of each list.
  listA.unshift(undefined);
  listB.unshift(undefined);

  // Initialize the scoring matrix.
  const matrix: number[][] = [];
  for (let i = 0; i < listA.length; i++) {
    const row = [];
    for (let j = 0; j < listB.length; j++) {
      row.push(i === 0 ? -j : j === 0 ? -i : 0);
    }
    matrix.push(row);
  }

  // Process the scoring matrix.
  for (let i = 1; i < listA.length; i++) {
    for (let j = 1; j < listB.length; j++) {
      const match =
        matrix[i - 1][j - 1] + scoringFunction(listA[i].obj, listB[j].obj);
      const ins = matrix[i][j - 1] + INDEL;
      const del = matrix[i - 1][j] + INDEL;
      matrix[i][j] = Math.max(match, ins, del);
    }
  }

  // Backtracking.
  let i = listA.length - 1;
  let j = listB.length - 1;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0
      && matrix[i][j] === matrix[i - 1][j - 1]
      + scoringFunction(listA[i].obj, listB[j].obj)) {
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
