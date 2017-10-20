// TODO: test stroked paths

import { Command, Path, PathUtil } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import * as _ from 'lodash';

import { Alignment, MATCH, MISMATCH, align } from './NeedlemanWunsch';

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

/**
 * Takes two arbitrary paths, calculates a best-estimate alignment of the two,
 * and then inserts no-op commands into the alignment gaps to make the two paths
 * compatible with each other.
 */
export function autoFix(from: Path, to: Path): [Path, Path] {
  [from, to] = autoUnconvertSubPaths(from, to);
  [from, to] = autoAddCollapsingSubPaths(from, to);
  [from, to] = orderSubPaths(from, to);

  const min = Math.min(from.getSubPaths().length, to.getSubPaths().length);
  for (let subIdx = 0; subIdx < min; subIdx++) {
    // Pass the command with the larger subpath as the 'from' command.
    const numFromCmds = from.getSubPath(subIdx).getCommands().length;
    const numToCmds = to.getSubPath(subIdx).getCommands().length;
    const shouldSwap = numFromCmds < numToCmds;
    if (shouldSwap) {
      [from, to] = [to, from];
    }
    [from, to] = alignSubPath(from, to, subIdx);
    if (shouldSwap) {
      [from, to] = [to, from];
    }
  }
  for (let subIdx = 0; subIdx < min; subIdx++) {
    [from, to] = permuteSubPath(from, to, subIdx);
  }
  return [from, to];
}

function autoUnconvertSubPaths(from: Path, to: Path) {
  return [from, to].map(p => {
    const pm = p.mutate();
    p.getSubPaths().forEach((unused, subIdx) => pm.unconvertSubPath(subIdx));
    return pm.build();
  }) as [Path, Path];
}

export function autoAddCollapsingSubPaths(from: Path, to: Path): [Path, Path] {
  const deleteCollapsingSubPathsFn = (p: Path) => {
    return p.getSubPaths().some(s => s.isCollapsing())
      ? p
          .mutate()
          .deleteCollapsingSubPaths()
          .build()
      : p;
  };
  from = deleteCollapsingSubPathsFn(from);
  to = deleteCollapsingSubPathsFn(to);

  const numFrom = from.getSubPaths().length;
  const numTo = to.getSubPaths().length;
  if (numFrom === numTo) {
    return [from, to];
  }
  // TODO: allow the user to specify the location of collapsing paths?
  const pm = (numFrom < numTo ? from : to).mutate();
  for (let subIdx = Math.min(numFrom, numTo); subIdx < Math.max(numFrom, numTo); subIdx++) {
    const opp = numFrom < numTo ? to : from;
    const pole = opp.getPoleOfInaccessibility(subIdx);
    pm.addCollapsingSubPath(pole, opp.getSubPath(subIdx).getCommands().length);
  }
  if (numFrom < numTo) {
    from = pm.build();
  } else {
    to = pm.build();
  }
  return [from, to];
}

/**
 * Reorders the subpaths in each path to minimize the distance each shape will
 * travel during the morph.
 */
function orderSubPaths(from: Path, to: Path): [Path, Path] {
  if (from.getSubPaths().length > 8 || to.getSubPaths().length > 8) {
    // Don't attempt to order paths with many subpaths.
    return [from, to];
  }

  const shouldSwap = from.getSubPaths().length < to.getSubPaths().length;
  if (shouldSwap) {
    [from, to] = [to, from];
  }

  const fromSubPaths = from.getSubPaths();
  const toSubPaths = to.getSubPaths();

  const distances = fromSubPaths.map((f, i) => {
    return toSubPaths.map((t, j) => {
      const pole1 = from.getPoleOfInaccessibility(i);
      const pole2 = to.getPoleOfInaccessibility(j);
      return MathUtil.distance(pole1, pole2);
    });
  });

  let min = Infinity;
  let best: number[] = [];

  (function recurseFn(arr: number[], order: number[] = []) {
    if (order.length === toSubPaths.length) {
      let sum = 0;
      for (let i = 0; i < order.length; i++) {
        sum += distances[order[i]][i];
      }
      if (sum < min) {
        min = sum;
        best = order;
      }
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      const [cur] = arr.splice(i, 1);
      recurseFn([...arr], [...order, cur]);
      if (arr.length) {
        arr.splice(i, 0, cur);
      }
    }
  })(_.range(fromSubPaths.length));

  const pm = from.mutate();
  for (let i = 0; i < best.length; i++) {
    const m = best[i];
    pm.moveSubPath(m, i);
    for (let j = i + 1; j < best.length; j++) {
      const n = best[j];
      if (n < m) {
        best[j]++;
      }
    }
  }
  from = pm.build();

  if (shouldSwap) {
    [from, to] = [to, from];
  }

  return [from, to];
}

/** Aligns two paths using the Needleman-Wunsch algorithm. */
function alignSubPath(from: Path, to: Path, subIdx: number): [Path, Path] {
  // Create and return a list of reversed and shifted from paths to test.
  // Each generated 'from path' will be aligned with the target 'to path'.
  const fromPaths: ReadonlyArray<Path> = _.flatMap(
    [
      from,
      from
        .mutate()
        .reverseSubPath(subIdx)
        .build(),
    ],
    p => {
      const paths = [p];
      if (p.getSubPath(subIdx).isClosed()) {
        for (let i = 1; i < p.getSubPath(subIdx).getCommands().length - 1; i++) {
          // TODO: we need to find a way to reduce the number of paths to try.
          paths.push(
            p
              .mutate()
              .shiftSubPathBack(subIdx, i)
              .build(),
          );
        }
      }
      return paths;
    },
  );

  // The scoring function to use to calculate the alignment. Convert-able
  // commands are considered matches. However, the farther away the points
  // are from each other, the lower the score.
  const getScoreFn = (a: Command, b: Command) => {
    const charA = a.getSvgChar();
    const charB = b.getSvgChar();
    if (charA !== charB && !a.canConvertTo(charB) && !b.canConvertTo(charA)) {
      return MISMATCH;
    }
    const { x, y } = a.getEnd();
    const start = { x, y };
    const end = b.getEnd();
    return 1 / Math.max(MATCH, MathUtil.distance(start, end));
  };

  const alignmentInfos = fromPaths.map(generatedFromPath => {
    const fromCmds = generatedFromPath.getSubPath(subIdx).getCommands();
    const toCmds = to.getSubPath(subIdx).getCommands();
    return {
      generatedFromPath,
      alignment: align(fromCmds, toCmds, getScoreFn),
    };
  });

  // Find the alignment with the highest score.
  const alignmentInfo = alignmentInfos.reduce((prev, curr) => {
    const prevScore = prev.alignment.score;
    const currScore = curr.alignment.score;
    return prevScore > currScore ? prev : curr;
  });

  interface CmdInfo {
    readonly isGap: boolean;
    readonly isNextGap: boolean;
    readonly nextCmdIdx: number;
  }

  // For each alignment, determine whether it and its neighbor is a gap.
  const processAlignmentsFn = (
    alignments: ReadonlyArray<Alignment<Command>>,
  ): ReadonlyArray<CmdInfo> => {
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
  const createGapStreaksFn = (cmdInfos: ReadonlyArray<CmdInfo>) => {
    const gapStreaks: CmdInfo[][] = [];
    let currentGapStreak: CmdInfo[] = [];
    for (const cmdInfo of cmdInfos) {
      if (cmdInfo.isGap) {
        currentGapStreak.push(cmdInfo);
        if (!cmdInfo.isNextGap) {
          gapStreaks.push(currentGapStreak);
          currentGapStreak = [];
        }
      }
    }
    return gapStreaks as ReadonlyTable<CmdInfo>;
  };
  const fromGapGroups = createGapStreaksFn(fromCmdInfos);
  const toGapGroups = createGapStreaksFn(toCmdInfos);

  // Fill in the gaps by applying linear subdivide batch splits.
  const applySplitsFn = (path: Path, gapGroups: ReadonlyTable<CmdInfo>) => {
    const splitOps: Array<{
      readonly subIdx: number;
      readonly cmdIdx: number;
      readonly ts: number[];
    }> = [];
    const numPaths = path.getSubPath(subIdx).getCommands().length;
    for (let i = gapGroups.length - 1; i >= 0; i--) {
      const gapGroup = gapGroups[i];
      // Clamp the index between 1 and numCommands - 1 to account for cases
      // where the alignment algorithm attempts to append new commands to the
      // front and back of the sequence.
      const cmdIdx = _.clamp(_.last(gapGroup).nextCmdIdx, 1, numPaths - 1);
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
  const toPathResult = applySplitsFn(to, toGapGroups);

  // Finally, convert the commands before returning the result.
  return autoConvertSubPath(fromPathResult, toPathResult, subIdx);
}

/**
 * Takes two paths with an equal number of commands and makes them compatible
 * by converting each pair one-by-one.
 */
export function autoConvert(from: Path, to: Path): [Path, Path] {
  [from, to] = autoUnconvertSubPaths(from, to);
  const numFrom = from.getSubPaths().length;
  const numTo = to.getSubPaths().length;
  for (let subIdx = 0; subIdx < Math.min(numFrom, numTo); subIdx++) {
    // Only auto convert when the number of commands in both canvases
    // are equal. Otherwise we'll wait for the user to add more points.
    [from, to] = autoConvertSubPath(from, to, subIdx);
  }
  return [from, to];
}

function autoConvertSubPath(from: Path, to: Path, subIdx: number): [Path, Path] {
  const numFrom = from.getSubPath(subIdx).getCommands().length;
  const numTo = to.getSubPath(subIdx).getCommands().length;
  if (numFrom !== numTo) {
    // Only auto convert when the number of commands in both subpaths are equal.
    return [from, to];
  }
  const fromPm = from.mutate();
  const toPm = to.mutate();
  for (let cmdIdx = 0; cmdIdx < numFrom; cmdIdx++) {
    const fromCmd = from.getCommand(subIdx, cmdIdx);
    const toCmd = to.getCommand(subIdx, cmdIdx);
    if (fromCmd.getSvgChar() === toCmd.getSvgChar()) {
      continue;
    }
    if (fromCmd.canConvertTo(toCmd.getSvgChar())) {
      fromPm.convertCommand(subIdx, cmdIdx, toCmd.getSvgChar());
    } else if (toCmd.canConvertTo(fromCmd.getSvgChar())) {
      toPm.convertCommand(subIdx, cmdIdx, fromCmd.getSvgChar());
    }
  }
  return [fromPm.build(), toPm.build()];
}

function permuteSubPath(from: Path, to: Path, subIdx: number): [Path, Path] {
  if (from.isClockwise(subIdx) !== to.isClockwise(subIdx)) {
    // Make sure the paths share the same direction.
    to = to
      .mutate()
      .reverseSubPath(subIdx)
      .build();
  }

  // Create and return a list of reversed and shifted from paths to test.
  // Each generated 'from path' will be aligned with the target 'to path'.
  const fromPaths: Path[] = [from];
  if (from.getSubPath(subIdx).isClosed()) {
    for (let i = 1; i < from.getSubPath(subIdx).getCommands().length - 1; i++) {
      // TODO: we need to find a way to reduce the number of paths to try.
      fromPaths.push(
        from
          .mutate()
          .shiftSubPathBack(subIdx, i)
          .build(),
      );
    }
  }

  let bestFromPath = from;
  let min = Infinity;
  for (const fromPath of fromPaths) {
    const fromCmds = fromPath.getSubPath(subIdx).getCommands();
    let sumOfSquares = 0;
    const toCmds = to.getSubPath(subIdx).getCommands();
    fromCmds.forEach(
      (c, cmdIdx) => (sumOfSquares += MathUtil.distance(c.getEnd(), toCmds[cmdIdx].getEnd()) ** 2),
    );
    if (sumOfSquares < min) {
      min = sumOfSquares;
      bestFromPath = fromPath;
    }
  }

  return [bestFromPath, to];
}
