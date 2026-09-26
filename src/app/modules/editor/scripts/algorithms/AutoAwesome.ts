// TODO: test stroked paths

import { Command, Path, PathUtil } from 'app/modules/editor/model/paths';
import { newCalculator } from 'app/modules/editor/model/paths/calculators';
import { bugsnagClient } from 'app/modules/editor/scripts/bugsnag';
import { MathUtil, Point } from 'app/modules/editor/scripts/common';
import _ from 'lodash';

import { assign } from './Hungarian';
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
  // TODO: remove this once we fix the bug below
  const origFrom = from.getPathString();
  const origTo = to.getPathString();
  try {
    [from, to] = autoUnconvertSubPaths(from, to);
    [from, to] = pairSubPaths(from, to);
    [from, to] = autoAddCollapsingSubPaths(from, to);

    const min = Math.min(from.getSubPaths().length, to.getSubPaths().length);
    for (let subIdx = 0; subIdx < min; subIdx++) {
      if (isMoveOnly(from, subIdx) || isMoveOnly(to, subIdx)) {
        // A subpath that's only a move has no segment to split, so it's padded below instead.
        continue;
      }
      if (isCollapsing(from, subIdx) || isCollapsing(to, subIdx)) {
        // A collapsing subpath is a point with as many commands as the subpath it grows into, so
        // all they need is matching types. Aligning or permuting them would only move the other
        // subpath's start around.
        [from, to] = autoConvertSubPath(from, to, subIdx);
        continue;
      }
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
      const isAligned = [from, to].every(p => !isMoveOnly(p, subIdx) && !isCollapsing(p, subIdx));
      if (isAligned) {
        [from, to] = permuteSubPath(from, to, subIdx);
      }
    }
    [from, to] = padMoveOnlySubPaths(from, to);
  } catch (e) {
    // TODO: remove this once we determine what is causing this bug...
    console.error('autofix failed', origFrom, origTo);
    bugsnagClient.leaveBreadcrumb('autoFix', {
      from: origFrom,
      to: origTo,
    });
    throw e;
  }
  return [from, to];
}

const isCollapsing = (path: Path, subIdx: number) => path.getSubPath(subIdx).isCollapsing();

/** Returns true if the subpath is only a move, like a stray "M 5 5" in the path data. */
const isMoveOnly = (path: Path, subIdx: number) =>
  path.getSubPath(subIdx).getCommands().length === 1;

/**
 * Pads each subpath that's only a move, and is paired with one that isn't, with commands of the
 * same types as the other subpath's, all at the move's point. That makes the pair morphable, with
 * the other subpath growing from (or collapsing to) the point.
 */
function padMoveOnlySubPaths(from: Path, to: Path): [Path, Path] {
  const fromPm = from.mutate();
  const toPm = to.mutate();
  const min = Math.min(from.getSubPaths().length, to.getSubPaths().length);
  for (let subIdx = 0; subIdx < min; subIdx++) {
    const svgCharsAfterMove = (path: Path) =>
      path
        .getSubPath(subIdx)
        .getCommands()
        .slice(1)
        .map(cmd => cmd.type);
    if (isMoveOnly(from, subIdx) && !isMoveOnly(to, subIdx)) {
      fromPm.padSubPath(subIdx, svgCharsAfterMove(to));
    } else if (isMoveOnly(to, subIdx) && !isMoveOnly(from, subIdx)) {
      toPm.padSubPath(subIdx, svgCharsAfterMove(from));
    }
  }
  return [fromPm.build(), toPm.build()];
}

function autoUnconvertSubPaths(from: Path, to: Path) {
  return [from, to].map(p => {
    const pm = p.mutate();
    p.getSubPaths().forEach((unused, subIdx) => pm.unconvertSubPath(subIdx));
    return pm.build();
  }) as [Path, Path];
}

const deleteCollapsingSubPaths = (path: Path) =>
  path.getSubPaths().some(s => s.isCollapsing())
    ? path.mutate().deleteCollapsingSubPaths().build()
    : path;

/**
 * Gives the path with fewer subpaths collapsing ones to grow from (or collapse into), one for
 * each of the other path's last subpaths that has no partner.
 */
export function autoAddCollapsingSubPaths(from: Path, to: Path): [Path, Path] {
  from = deleteCollapsingSubPaths(from);
  to = deleteCollapsingSubPaths(to);

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
 * Pairs each subpath of the path with fewer subpaths with a subpath of the other path, so that the
 * total distance between the centers of the pairs is as small as possible, and reorders the other
 * path's subpaths to match. Its subpaths without a partner go last, where
 * autoAddCollapsingSubPaths gives each one a collapsing subpath at its own center to grow from.
 */
function pairSubPaths(from: Path, to: Path): [Path, Path] {
  from = deleteCollapsingSubPaths(from);
  to = deleteCollapsingSubPaths(to);
  const shouldReorderFrom = from.getSubPaths().length >= to.getSubPaths().length;
  const [longer, shorter] = shouldReorderFrom ? [from, to] : [to, from];
  const centers = (path: Path) =>
    path.getSubPaths().map((unused, subIdx) => path.getPoleOfInaccessibility(subIdx));
  const longerCenters = centers(longer);
  const partners = assign(
    centers(shorter).map(p => longerCenters.map(q => MathUtil.distance(p, q))),
  );
  const order = [
    ...partners,
    ..._.range(longerCenters.length).filter(subIdx => !partners.includes(subIdx)),
  ];

  // Move each subpath into place in turn, keeping track of where the rest are.
  const pm = longer.mutate();
  const currentOrder = _.range(order.length);
  order.forEach((subIdx, i) => {
    const currentIdx = currentOrder.indexOf(subIdx);
    pm.moveSubPath(currentIdx, i);
    currentOrder.splice(i, 0, ...currentOrder.splice(currentIdx, 1));
  });
  const reordered = pm.build();
  return shouldReorderFrom ? [reordered, to] : [from, reordered];
}

/** Returns the length of the diagonal of the commands' end points' bounding box, or 1 if it's 0. */
function getDiagonal(commands: ReadonlyArray<Command>) {
  const xs = commands.map(c => c.end.x);
  const ys = commands.map(c => c.end.y);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return diagonal || 1;
}

/** Aligns two paths using the Needleman-Wunsch algorithm. */
function alignSubPath(from: Path, to: Path, subIdx: number): [Path, Path] {
  const fromPaths = getAlignmentCandidates(from, to, subIdx);

  // The scoring function to use to calculate the alignment. Convert-able commands are considered
  // matches, and the farther apart their points are, the lower the score. Distances are measured
  // relative to the size of the subpaths, so that the alignment doesn't depend on the units
  // they're drawn in, and points closer than a 24th of it (a unit in a 24 x 24 icon) count as
  // being in the same place.
  const size = getDiagonal([
    ...from.getSubPath(subIdx).getCommands(),
    ...to.getSubPath(subIdx).getCommands(),
  ]);
  const getScoreFn = (a: Command, b: Command) => {
    const charA = a.type;
    const charB = b.type;
    if (charA !== charB && !a.canConvertTo(charB) && !b.canConvertTo(charA)) {
      return MISMATCH;
    }
    return MATCH / Math.max(1 / 24, MathUtil.distance(a.end, b.end) / size);
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

  // Fill in each streak of gaps in one path by splitting the command after it, so that each new
  // point starts near the point it morphs into, instead of evenly spread along the command.
  const applySplitsFn = (
    path: Path,
    alignments: ReadonlyArray<Alignment<Command>>,
    others: ReadonlyArray<Alignment<Command>>,
  ) => {
    const splitOps: Array<{
      readonly subIdx: number;
      readonly cmdIdx: number;
      readonly ts: number[];
    }> = [];
    const numCmds = path.getSubPath(subIdx).getCommands().length;
    let nextCmdIdx = 0;
    let i = 0;
    while (i < alignments.length) {
      if (alignments[i].obj) {
        nextCmdIdx++;
        i++;
        continue;
      }
      const streakStart = i;
      while (i < alignments.length && !alignments[i].obj) {
        i++;
      }
      // Clamp the index between 1 and numCommands - 1 to account for cases where the alignment
      // algorithm attempts to append new commands to the front and back of the sequence.
      const cmdIdx = _.clamp(nextCmdIdx, 1, numCmds - 1);
      const numGaps = i - streakStart;
      const ts =
        (cmdIdx === nextCmdIdx &&
          getSplitTimes(
            alignments[i].obj,
            others.slice(streakStart, i + 1).map(a => a.obj),
          )) ||
        _.range(1, numGaps + 1).map(n => n / (numGaps + 1));
      splitOps.push({ subIdx, cmdIdx, ts });
    }
    PathUtil.sortPathOps(splitOps);
    const mutator = path.mutate();
    for (const { cmdIdx, ts } of splitOps) {
      mutator.splitCommand(subIdx, cmdIdx, ...ts);
    }
    return mutator.build();
  };

  const { from: fromAlignments, to: toAlignments } = alignmentInfo.alignment;
  const fromPathResult = applySplitsFn(
    alignmentInfo.generatedFromPath,
    fromAlignments,
    toAlignments,
  );
  const toPathResult = applySplitsFn(to, toAlignments, fromAlignments);

  // Finally, convert the commands before returning the result.
  return autoConvertSubPath(fromPathResult, toPathResult, subIdx);
}

/**
 * Returns the times at which to split a command so that each new point starts near the point
 * it morphs into, given the other path's commands it's aligned with (the ones whose end points
 * the new points morph into, then the one the command itself is aligned with). The new points go
 * where those end points are nearest the command, if that keeps them in order, or else at the
 * same fractions of the command's length as the commands take up of theirs. Returns undefined if
 * neither works, e.g. when the commands have no length.
 */
function getSplitTimes(cmd: Command | undefined, otherCmds: ReadonlyArray<Command | undefined>) {
  if (!cmd || otherCmds.some(c => !c)) {
    return undefined;
  }
  const calculator = newCalculator(cmd);
  if (!calculator.getPathLength()) {
    return undefined;
  }
  const isIncreasing = (ts: ReadonlyArray<number>) =>
    ts.every((t, i) => 0 < t && t < 1 && (!i || ts[i - 1] < t));

  const partners = otherCmds.slice(0, -1).map(c => (c ? c.end : cmd.end));
  const projectedTs = partners.map(p => calculator.project(p)?.t ?? -1);
  if (isIncreasing(projectedTs)) {
    return projectedTs;
  }

  const lengths = otherCmds.map(c => (c ? newCalculator(c).getPathLength() : 0));
  const totalLength = _.sum(lengths);
  if (!totalLength) {
    return undefined;
  }
  let distance = 0;
  const ts = lengths.slice(0, -1).map(l => {
    distance += l;
    // This takes a fraction of the command's length.
    return calculator.findTimeByDistance(distance / totalLength);
  });
  return isIncreasing(ts) ? ts : undefined;
}

/** The most candidates alignSubPath aligns in full, out of every reversal and shift. */
const MAX_ALIGNMENT_CANDIDATES = 10;

/**
 * Returns the from path, reversed or not, and shifted to each of its start points if the subpath
 * is closed, for alignSubPath to align with the to path. There are two for each point, and each
 * alignment takes time proportional to the product of the subpaths' lengths, so when there are
 * many, it only returns the few whose points are closest to the to path's at proportional
 * positions, which is quick to find without building the paths.
 */
function getAlignmentCandidates(from: Path, to: Path, subIdx: number): Path[] {
  const toEnds = to
    .getSubPath(subIdx)
    .getCommands()
    .map(cmd => cmd.end);
  const size = getDiagonal([
    ...from.getSubPath(subIdx).getCommands(),
    ...to.getSubPath(subIdx).getCommands(),
  ]);
  const score = (ends: ReadonlyArray<Point>) =>
    _.sum(
      ends.map((p, i) => {
        const q = toEnds[Math.round((i * (toEnds.length - 1)) / Math.max(1, ends.length - 1))];
        return 1 / Math.max(1 / 24, MathUtil.distance(p, q) / size);
      }),
    );
  const candidates = [from, from.mutate().reverseSubPath(subIdx).build()].flatMap(path =>
    getShiftedEndPoints(path, subIdx).map((ends, numShifts) => ({ path, numShifts, ends })),
  );
  const chosen =
    candidates.length <= MAX_ALIGNMENT_CANDIDATES
      ? candidates
      : _.sortBy(
          _.sortBy(candidates, c => -score(c.ends)).slice(0, MAX_ALIGNMENT_CANDIDATES),
          // Keep them in the original order, which breaks ties between their alignments.
          c => candidates.indexOf(c),
        );
  return chosen.map(({ path, numShifts }) =>
    numShifts ? path.mutate().shiftSubPathBack(subIdx, numShifts).build() : path,
  );
}

/**
 * Returns the end points of a subpath's commands after shiftSubPathBack(subIdx, n), for each n
 * from 0 to one less than its number of points, without building each shifted path. An open
 * subpath can't be shifted, so it only has its own.
 */
function getShiftedEndPoints(path: Path, subIdx: number): Point[][] {
  const subPath = path.getSubPath(subIdx);
  const ends = subPath.getCommands().map(cmd => cmd.end);
  const numPoints = ends.length - 1;
  if (!subPath.isClosed() || numPoints < 2) {
    return [ends];
  }
  // A shift rotates the ring of points. Find out which way by shifting once.
  const ring = ends.slice(0, numPoints);
  const shiftedOnce = path.mutate().shiftSubPathBack(subIdx, 1).build();
  const shiftedOnceEnds = shiftedOnce
    .getSubPath(subIdx)
    .getCommands()
    .map(cmd => cmd.end);
  const rotate = (step: number, numShifts: number) => {
    const offset = MathUtil.floorMod(step * numShifts, numPoints);
    const rotated = _.range(numPoints).map(i => ring[(offset + i) % numPoints]);
    return [...rotated, rotated[0]];
  };
  const matches = (a: ReadonlyArray<Point>, b: ReadonlyArray<Point>) =>
    a.length === b.length && a.every((p, i) => MathUtil.arePointsEqual(p, b[i]));
  const step = [1, -1].find(s => matches(rotate(s, 1), shiftedOnceEnds));
  if (step === undefined) {
    // The mutator ignores shifts of a subpath whose end doesn't quite meet its start.
    return [ends];
  }
  return _.range(numPoints).map(numShifts => rotate(step, numShifts));
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
    if (fromCmd.type === toCmd.type) {
      continue;
    }
    if (fromCmd.canConvertTo(toCmd.type)) {
      fromPm.convertCommand(subIdx, cmdIdx, toCmd.type);
    } else if (toCmd.canConvertTo(fromCmd.type)) {
      toPm.convertCommand(subIdx, cmdIdx, fromCmd.type);
    }
  }
  return [fromPm.build(), toPm.build()];
}

function permuteSubPath(from: Path, to: Path, subIdx: number): [Path, Path] {
  const isClosed = (path: Path) => path.getSubPath(subIdx).isClosed();
  if (isClosed(from) && isClosed(to) && from.isClockwise(subIdx) !== to.isClockwise(subIdx)) {
    // Make sure the subpaths go the same direction. Open subpaths don't need to, and alignSubPath
    // has already picked the direction that lines up their points best.
    to = to.mutate().reverseSubPath(subIdx).build();
  }

  // Shift the from subpath to whichever start point moves the points the least.
  const toEnds = to
    .getSubPath(subIdx)
    .getCommands()
    .map(cmd => cmd.end);
  const sumOfSquares = (ends: ReadonlyArray<Point>) =>
    _.sum(ends.map((p, cmdIdx) => MathUtil.distance(p, toEnds[cmdIdx]) ** 2));
  const shiftedEnds = getShiftedEndPoints(from, subIdx);
  let numShifts = 0;
  let min = Infinity;
  shiftedEnds.forEach((ends, i) => {
    const sum = sumOfSquares(ends);
    if (sum < min) {
      min = sum;
      numShifts = i;
    }
  });
  const bestFromPath = numShifts ? from.mutate().shiftSubPathBack(subIdx, numShifts).build() : from;

  // Reversing and shifting reorder the commands, so the conversions that made their types match
  // no longer line up. Convert them again.
  const unconvert = (path: Path) => path.mutate().unconvertSubPath(subIdx).build();
  return autoConvertSubPath(unconvert(bestFromPath), unconvert(to), subIdx);
}
