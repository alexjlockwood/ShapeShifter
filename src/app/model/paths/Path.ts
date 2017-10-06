import { MathUtil, Matrix, Point } from 'app/scripts/common';
import { environment } from 'environments/environment';
import * as _ from 'lodash';

import { Projection } from './calculators';
import { Command } from './Command';
import { CommandState } from './CommandState';
import * as PathParser from './PathParser';
import { PathState } from './PathState';
import { SubPathState, SubPathStateMutator, flattenSubPathStates } from './SubPathState';
import { SvgChar } from './SvgChar';

/**
 * A compound path that contains all of the information associated with a
 * PathLayer's pathData attribute.
 */
export class Path {
  private readonly ps: PathState;
  private pathString: string;

  constructor(obj: string | Command[] | PathState) {
    this.ps = typeof obj === 'string' || Array.isArray(obj) ? new PathState(obj) : obj;
    if (!environment.production) {
      // Don't initialize variables lazily for dev builds (to avoid
      // ngrx-store-freeze crashes).
      this.getPathString();

      const allIds = this.getCommands().map(c => c.getId());
      const uniqueIds = new Set(allIds);
      const numCommands = allIds.length;
      if (uniqueIds.size !== numCommands) {
        const dumpInfo = this.getSubPaths().map((s, subIdx) => {
          return s.getCommands().map((c, cmdIdx) => {
            return {
              subIdx,
              cmdIdx,
              id: c.getId(),
              isDup: allIds.filter(id => id === c.getId()).length > 1,
            };
          });
        });
        console.warn('duplicate IDs found!', this, _.flatten(dumpInfo));
      }
    }
  }

  /**
   * Returns the path's SVG path string.
   */
  getPathString() {
    if (this.pathString === undefined) {
      this.pathString = PathParser.commandsToString(this.getCommands());
    }
    return this.pathString;
  }

  /**
   * Returns the list of SubPaths in this path.
   */
  getSubPaths() {
    return this.ps.subPaths;
  }

  /**
   * Returns the subpath at the specified index.
   */
  getSubPath(subIdx: number) {
    const numSubPaths = this.getSubPaths().length;
    if (subIdx < 0 || numSubPaths <= subIdx) {
      console.error(this);
      throw new Error(
        `Subpath index out of bounds: ` + `subIdx=${subIdx} numSubPaths=${numSubPaths}`,
      );
    }
    return this.getSubPaths()[subIdx];
  }

  /**
   * Returns the list of Commands in this path.
   */
  getCommands() {
    return this.ps.commands;
  }

  /**
   * Returns the command at the specified index.
   */
  getCommand(subIdx: number, cmdIdx: number) {
    const subPath = this.getSubPath(subIdx);
    const numCommands = subPath.getCommands().length;
    if (cmdIdx < 0 || numCommands <= cmdIdx) {
      console.error(this);
      throw new Error(
        `Command index out of bounds: ` +
          `subIdx=${subIdx} cmdIdx=${cmdIdx}, numCommands=${numCommands}`,
      );
    }
    return subPath.getCommands()[cmdIdx];
  }

  /**
   * Returns the length of the path.
   */
  getPathLength() {
    return this.ps.getPathLength();
  }

  /**
   * Returns the length of the subpath.
   */
  getSubPathLength(subIdx: number) {
    return this.ps.getSubPathLength(subIdx);
  }

  /**
   * Returns the point at the given length along the path.
   */
  getPointAtLength(distance: number) {
    return this.ps.getPointAtLength(distance);
  }

  /**
   * Returns true iff this path is morphable with the specified path.
   */
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return (
      cmds1.length === cmds2.length &&
      cmds1.every((cmd1, i) => cmd1.getSvgChar() === cmds2[i].getSvgChar())
    );
  }

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Returns undefined if no point is found.
   */
  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    return this.ps.project(point, restrictToSubIdx);
  }

  /**
   * Performs a hit test on the path and returns a HitResult.
   */
  hitTest(point: Point, opts: HitOptions): HitResult {
    return this.ps.hitTest(point, opts);
  }

  /**
   * Returns the pole of inaccessibility for the specified subpath index.
   */
  getPoleOfInaccessibility(subIdx: number) {
    return this.ps.getPoleOfInaccessibility(subIdx);
  }

  /**
   * Returns the bounding box for this path.
   */
  getBoundingBox() {
    return this.ps.getBoundingBox();
  }

  /**
   * Returns true iff the subpath at the specified index is clockwise.
   */
  isClockwise(subIdx: number) {
    return this.ps.isClockwise(subIdx);
  }

  /**
   * Transforms the path using the specified transform matrix.
   */
  transform(transform: Matrix) {
    return this.mutate()
      .transform(transform)
      .build()
      .clone();
  }

  /**
   * Creates a builder that can create a mutated Path object.
   */
  mutate() {
    return new PathMutator(this.ps);
  }

  /**
   * Returns a cloned instance of this path. Any existing path state will be cleared.
   */
  clone() {
    return new Path(this.getPathString());
  }

  /**
   * Returns a Path representing its initial unmutated state.
   */
  revert() {
    return this.mutate()
      .revert()
      .build();
  }
}

/** Represents the options for a hit test. */
export interface HitOptions {
  readonly isPointInRangeFn?: (distance: number, cmd?: Command) => boolean;
  readonly isSegmentInRangeFn?: (distance: number, cmd?: Command) => boolean;
  readonly findShapesInRange?: boolean;
  readonly restrictToSubIdx?: ReadonlyArray<number>;
}

/** Represents the result of a hit test. */
export interface HitResult {
  readonly isHit: boolean;
  readonly isEndPointHit: boolean;
  readonly isSegmentHit: boolean;
  readonly isShapeHit: boolean;
  readonly endPointHits?: ReadonlyArray<ProjectionOntoPath>;
  readonly segmentHits?: ReadonlyArray<ProjectionOntoPath>;
  readonly shapeHits?: Array<{ subIdx: number }>;
}

export interface ProjectionOntoPath {
  readonly subIdx: number;
  readonly cmdIdx: number;
  readonly projection: Projection;
}

const ENABLE_LOGS = !environment.production && false;

/**
 * A builder class for creating mutated Path objects.
 */
export class PathMutator {
  // A tree of sub path state objects, including collapsing sub paths.
  private subPathStateMap: SubPathState[];
  // Maps subIdx --> spsIdx.
  private subPathOrdering: number[];
  private numCollapsingSubPaths: number;

  constructor(ps: PathState) {
    this.subPathStateMap = [...ps.subPathStateMap];
    this.subPathOrdering = [...ps.subPathOrdering];
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    LOG('reverseSubPath', subIdx);
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx)
        .mutate()
        .reverse()
        .build(),
    );
    return this;
  }

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   */
  shiftSubPathBack(subIdx: number, numShifts = 1) {
    LOG('shiftSubPathBack', subIdx, numShifts);
    return this.findSubPathStateLeaf(subIdx).isReversed()
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    LOG('shiftSubPathForward', subIdx, numShifts);
    return this.findSubPathStateLeaf(subIdx).isReversed()
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const sps = this.findSubPathStateLeaf(subIdx);
    const numCmdsInSubPath = _.sumBy(sps.getCommandStates(), cs => cs.getCommands().length);
    if (numCmdsInSubPath <= 1) {
      return this;
    }
    const firstCmd = sps.getCommandStates()[0].getCommands()[0];
    const lastCmd = _.last(_.last(sps.getCommandStates()).getCommands());
    if (!MathUtil.arePointsEqual(firstCmd.getEnd(), lastCmd.getEnd())) {
      // TODO: in some cases there may be rounding errors that cause a closed subpath
      // to show up as non-closed. is there anything we can do to alleviate this?
      console.warn('Ignoring attempt to shift a non-closed subpath');
      return this;
    }
    this.setSubPathStateLeaf(
      subIdx,
      sps
        .mutate()
        .setShiftOffset(calcOffsetFn(sps.getShiftOffset(), numCmdsInSubPath))
        .build(),
    );
    return this;
  }

  /**
   * Splits the command using the specified t values.
   */
  splitCommand(subIdx: number, cmdIdx: number, ...ts: number[]) {
    LOG('splitCommand', subIdx, cmdIdx, ts);
    if (!ts.length) {
      throw new Error('Must specify at least one t value');
    }
    const { targetCs, csIdx, splitIdx } = this.findReversedAndShiftedInternalIndices(
      subIdx,
      cmdIdx,
    );
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(subIdx, csIdx, ts.length);
    const sps = this.findSubPathStateLeaf(subIdx);
    if (sps.isReversed()) {
      ts = ts.map(t => 1 - t);
    }
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx)
        .mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(
          csIdx,
          targetCs
            .mutate()
            .splitAtIndex(splitIdx, ts)
            .build(),
        )
        .build(),
    );
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    LOG('splitCommandInHalf', subIdx, cmdIdx);
    const { targetCs, csIdx, splitIdx } = this.findReversedAndShiftedInternalIndices(
      subIdx,
      cmdIdx,
    );
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(subIdx, csIdx, 1);
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx)
        .mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(
          csIdx,
          targetCs
            .mutate()
            .splitInHalfAtIndex(splitIdx)
            .build(),
        )
        .build(),
    );
    return this;
  }

  // If 0 <= csIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private getUpdatedShiftOffsetsAfterSplit(subIdx: number, csIdx: number, numSplits: number) {
    const sps = this.findSubPathStateLeaf(subIdx);
    if (sps.getShiftOffset() && csIdx <= sps.getShiftOffset()) {
      return sps.getShiftOffset() + numSplits;
    }
    return sps.getShiftOffset();
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    LOG('unsplitCommand', subIdx, cmdIdx);
    const { targetCs, csIdx, splitIdx } = this.findReversedAndShiftedInternalIndices(
      subIdx,
      cmdIdx,
    );
    const isSubPathReversed = this.findSubPathStateLeaf(subIdx).isReversed();
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx)
        .mutate()
        .setCommandState(
          csIdx,
          targetCs
            .mutate()
            .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
            .build(),
        )
        .build(),
    );
    const shiftOffset = this.findSubPathStateLeaf(subIdx).getShiftOffset();
    if (shiftOffset && csIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.setSubPathStateLeaf(
        subIdx,
        this.findSubPathStateLeaf(subIdx)
          .mutate()
          .setShiftOffset(shiftOffset - 1)
          .build(),
      );
    }
    return this;
  }

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCs, csIdx, splitIdx } = this.findReversedAndShiftedInternalIndices(
      subIdx,
      cmdIdx,
    );
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx)
        .mutate()
        .setCommandState(
          csIdx,
          targetCs
            .mutate()
            .convertAtIndex(splitIdx, svgChar)
            .build(),
        )
        .build(),
    );
    return this;
  }

  /**
   * Reverts any conversions previously performed in the specified sub path.
   */
  unconvertSubPath(subIdx: number) {
    const sps = this.findSubPathStateLeaf(subIdx);
    const css = sps.getCommandStates().map((cs, csIdx) => {
      return csIdx === 0
        ? cs
        : cs
            .mutate()
            .unconvertSubpath()
            .build();
    });
    this.setSubPathStateLeaf(
      subIdx,
      sps
        .mutate()
        .setCommandStates(css)
        .build(),
    );
    return this;
  }

  /**
   * Transforms the path using the specified transformation matrix.
   */
  transform(transform: Matrix) {
    const spss = flattenSubPathStates(this.subPathStateMap);
    for (let spsIdx = 0; spsIdx < spss.length; spsIdx++) {
      const sps = spss[spsIdx];
      const css = sps.getCommandStates();
      const subIdx = this.subPathOrdering.indexOf(spsIdx);
      this.setSubPathStateLeaf(
        subIdx,
        sps
          .mutate()
          .setCommandStates(
            css.map(cs =>
              cs
                .mutate()
                .transform(transform)
                .build(),
            ),
          )
          .build(),
      );
    }
    return this;
  }

  /**
   * Moves a subpath from one index to another. Returns a new path object.
   */
  moveSubPath(fromSubIdx: number, toSubIdx: number) {
    LOG('moveSubPath', fromSubIdx, toSubIdx);
    this.subPathOrdering.splice(toSubIdx, 0, this.subPathOrdering.splice(fromSubIdx, 1)[0]);
    return this;
  }

  /**
   * Splits a stroked sub path using the specified indices.
   * A 'moveTo' command will be inserted after the command at 'cmdIdx'.
   */
  splitStrokedSubPath(subIdx: number, cmdIdx: number) {
    LOG('splitStrokedSubPath', subIdx, cmdIdx);
    const sps = this.findSubPathStateLeaf(subIdx);
    const css = reverseAndShiftCommandStates(
      sps.getCommandStates(),
      sps.isReversed(),
      sps.getShiftOffset(),
    );
    const { csIdx, splitIdx } = this.findInternalIndices(css, cmdIdx);
    const startCommandStates: CommandState[] = [];
    const endCommandStates: CommandState[] = [];
    for (let i = 0; i < css.length; i++) {
      if (i < csIdx) {
        startCommandStates.push(css[i]);
      } else if (csIdx < i) {
        endCommandStates.push(css[i]);
      } else {
        const splitPoint = css[i].getCommands()[splitIdx].getEnd();
        const { left, right } = css[i].slice(splitIdx);
        startCommandStates.push(left);
        let endMoveCs = new CommandState(new Command('M', [splitPoint, splitPoint]));
        if (sps.isReversed()) {
          endMoveCs = endMoveCs
            .mutate()
            .reverse()
            .build();
        }
        endCommandStates.push(endMoveCs);
        if (right) {
          endCommandStates.push(right);
        }
      }
    }
    const splitSubPaths = [
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    this.setSubPathStateLeaf(
      subIdx,
      sps
        .mutate()
        .setSplitSubPaths(splitSubPaths)
        .build(),
    );
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Deletes the stroked subpath at the specified index. The subpath's sibling
   * will be deleted as well.
   */
  deleteStrokedSubPath(subIdx: number) {
    LOG('unsplitStrokedSubPath', subIdx);
    const parent = this.findSubPathStateParent(subIdx);
    const splitId = _.last(
      _.last(parent.getSplitSubPaths()[0].getCommandStates()).getCommands(),
    ).getId();
    const mutator = parent.mutate().setSplitSubPaths([]);
    this.deleteSpsSplitPoint(parent.getCommandStates(), splitId, mutator);
    this.subPathStateMap = this.replaceSubPathStateNode(
      parent,
      (states, i) => (states[i] = mutator.build()),
    );
    this.updateOrderingAfterUnsplitSubPath(subIdx);
    return this;
  }

  /**
   * Splits a filled subpath using the specified indices.
   *
   * Consider the following filled subpath:
   *
   * 2-------------------3
   * |                   |
   * |                   |
   * |                   |
   * 1                   4
   * |                   |
   * |                   |
   * |                   |
   * 0-------------------5
   *
   * Splitting the filled subpath with startCmdIdx=1 and endCmdIdx=4
   * results in the following split subpaths:
   *
   * xxxxxxxxxxxxxxxxxxxxx    1-------->>>--------2
   * x                   x    |                   |
   * x                   x    ↑                   ↓
   * x                   x    |                   |
   * 1-------->>>--------2    0--------<<<--------3
   * |                   |    x                   x
   * ↑                   ↓    x                   x
   * |                   |    x                   x
   * 0--------<<<--------3    xxxxxxxxxxxxxxxxxxxxx
   */
  splitFilledSubPath(subIdx: number, startCmdIdx: number, endCmdIdx: number) {
    LOG('splitFilledSubPath', subIdx, startCmdIdx, endCmdIdx);
    const targetSps = this.findSubPathStateLeaf(subIdx);
    const targetCss = reverseAndShiftCommandStates(
      targetSps.getCommandStates(),
      targetSps.isReversed(),
      targetSps.getShiftOffset(),
    );

    const findTargetSplitIdxs = () => {
      let s = this.findInternalIndices(targetCss, startCmdIdx);
      let e = this.findInternalIndices(targetCss, endCmdIdx);
      if (s.csIdx > e.csIdx || (s.csIdx === e.csIdx && s.splitIdx > e.csIdx)) {
        // Make sure the start index appears before the end index in the path.
        const temp = s;
        s = e;
        e = temp;
      }
      return {
        startCsIdx: s.csIdx,
        startSplitIdx: s.splitIdx,
        endCsIdx: e.csIdx,
        endSplitIdx: e.splitIdx,
      };
    };

    // firstLeft: left portion of the 1st split segment (used in the 1st split path).
    // secondLeft: left portion of the 2nd split segment (used in the 2nd split path).
    // firstRight: right portion of the 1st split segment (used in the 2nd split path).
    // secondRight: right portion of the 2nd split segment (used in the 1st split path).
    const { startCsIdx, startSplitIdx, endCsIdx, endSplitIdx } = findTargetSplitIdxs();
    const { left: firstLeft, right: firstRight } = targetCss[startCsIdx].slice(startSplitIdx);
    const { left: secondLeft, right: secondRight } = targetCss[endCsIdx].slice(endSplitIdx);
    const startSplitCmd = firstLeft.getCommands()[startSplitIdx];
    const startSplitPoint = startSplitCmd.getEnd();
    const endSplitCmd = secondLeft.getCommands()[endSplitIdx];
    const endSplitPoint = endSplitCmd.getEnd();

    // Give both line segments the same unique ID so that we can later identify which
    // split segments were added together during the deletion phase.
    const splitSegmentId = _.uniqueId();
    const endLine = new CommandState(new Command('L', [endSplitPoint, startSplitPoint]))
      .mutate()
      .setSplitSegmentInfo(secondLeft, splitSegmentId)
      .build();
    const startLine = new CommandState(new Command('L', [startSplitPoint, endSplitPoint]))
      .mutate()
      .setSplitSegmentInfo(firstLeft, splitSegmentId)
      .build();

    const startCommandStates: CommandState[] = [];
    for (let i = 0; i < targetCss.length; i++) {
      if (i < startCsIdx || endCsIdx < i) {
        startCommandStates.push(targetCss[i]);
      } else if (i === startCsIdx) {
        startCommandStates.push(firstLeft);
        startCommandStates.push(startLine);
      } else if (i === endCsIdx && secondRight) {
        startCommandStates.push(secondRight);
      }
    }

    const endCommandStates: CommandState[] = [];
    for (let i = 0; i < targetCss.length; i++) {
      if (i === startCsIdx) {
        endCommandStates.push(
          new CommandState(new Command('M', [startSplitPoint, startSplitPoint]))
            .mutate()
            // The move command identifies the beginning of a new split segment,
            // so we'll mark it with the parent state as well (we'll need this
            // information later on if the segment is deleted). Note that unlike
            // the two segments above, we don't need to specify an ID here.
            .setSplitSegmentInfo(firstLeft, '')
            .build(),
        );
        if (firstRight) {
          endCommandStates.push(firstRight);
        }
      } else if (startCsIdx < i && i < endCsIdx) {
        endCommandStates.push(targetCss[i]);
      } else if (i === endCsIdx) {
        endCommandStates.push(secondLeft);
        endCommandStates.push(endLine);
      }
    }

    const splitSubPaths = [
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    const newStates: SubPathState[] = [];
    const parent = this.findSubPathStateParent(subIdx);

    // Find the backing IDs for each parent command state that is a split segment.
    const parentSplitBackingIds = _((parent ? parent.getCommandStates() : []) as CommandState[])
      .filter(cs => !!cs.getSplitSegmentId())
      .map(cs => cs.getBackingId())
      .value();

    // Find the backing IDs for each sibling command state that is a split segment,
    // not including split segments that were inherited from the parent.
    const siblingSplitBackingIds = _(targetSps.getCommandStates() as CommandState[])
      .filter(cs => !!cs.getSplitSegmentId() && !parentSplitBackingIds.includes(cs.getBackingId()))
      .map(cs => cs.getBackingId())
      .value();

    // Checking for the existence of 'firstRight' and 'secondRight' ensures that
    // paths connected to the end point of a deleted split segment will still be kept.
    if (
      this.subPathStateMap.includes(targetSps) ||
      (firstRight && siblingSplitBackingIds.includes(firstLeft.getBackingId())) ||
      (secondRight && siblingSplitBackingIds.includes(secondLeft.getBackingId()))
    ) {
      // If we are at the first level of the tree or if one of the new
      // split edges is a split segment, then add a new level to the tree.
      // If the already existing split segment is deleted, we want to
      // delete the split segment we are creating right now as well.
      newStates.push(
        targetSps
          .mutate()
          .setSplitSubPaths(splitSubPaths)
          .build(),
      );
    } else {
      // Otherwise insert the sub paths in the current level of the tree.
      newStates.push(...splitSubPaths);
    }

    // Insert the new SubPathStates into the tree.
    this.subPathStateMap = this.replaceSubPathStateNode(targetSps, (states, i) =>
      states.splice(i, 1, ...newStates),
    );
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Deletes the filled subpath at the specified index. All adjacent sibling subpaths
   * will be deleted as well (i.e. subpaths that share the same split segment ID).
   */
  deleteFilledSubPath(subIdx: number) {
    LOG('deleteFilledSubPath', subIdx);
    const targetCss = this.findSubPathStateLeaf(subIdx).getCommandStates();
    // Get the list of parent split segment IDs.
    const parentSplitSegIds = _(this.findSubPathStateParent(
      subIdx,
    ).getCommandStates() as CommandState[])
      .map(cs => cs.getSplitSegmentId())
      .compact()
      .uniq()
      .value();
    // Get the list of sibling split segment IDs, not including split segment
    // IDs inherited from the parent.
    const siblingSplitSegIds = _(targetCss as CommandState[])
      .map(cs => cs.getSplitSegmentId())
      .compact()
      .uniq()
      .difference(parentSplitSegIds)
      .value();
    siblingSplitSegIds.forEach(id => {
      const targetCs = _.find(targetCss, cs => cs.getSplitSegmentId() === id);
      const deletedSubIdxs = this.calculateDeletedSubIdxs(subIdx, targetCs);
      this.deleteFilledSubPathSegmentInternal(subIdx, targetCs);
      subIdx -= _.sumBy(deletedSubIdxs, idx => (idx <= subIdx ? 1 : 0));
    });
    return this;
  }

  /**
   * Deletes the subpath split segment with the specified indices.
   */
  deleteFilledSubPathSegment(subIdx: number, cmdIdx: number) {
    LOG('deleteSubPathSplitSegment', subIdx, cmdIdx);
    const { targetCs } = this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    this.deleteFilledSubPathSegmentInternal(subIdx, targetCs);
    return this;
  }

  /**
   * Deletes the subpath split segment with the specified index. The two subpaths
   * that share the split segment ID will be merged into a single subpath.
   */
  private deleteFilledSubPathSegmentInternal(subIdx: number, targetCs: CommandState) {
    // Get the SubPathState ID of the node representing the subpath with index 'subIdx'.
    const targetSpsId = this.findSubPathStateLeaf(subIdx).getId();
    // Get the split segment ID of the target command state object.
    const targetSplitSegId = targetCs.getSplitSegmentId();
    const psps = this.findSplitSegmentParentNode(targetSplitSegId);
    const pssps = psps.getSplitSubPaths();
    const pcss = psps.getCommandStates();
    // Find the first index of the split sub path containing the target.
    const splitSubPathIdx1 = _.findIndex(pssps, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === targetSplitSegId);
    });
    // Find the second index of the split sub path containing the target.
    const splitSubPathIdx2 = _.findLastIndex(pssps, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === targetSplitSegId);
    });
    const deletedSubIdxs = this.calculateDeletedSubIdxs(subIdx, targetCs);
    const splitCss1 = pssps[splitSubPathIdx1].getCommandStates();
    const splitCss2 = pssps[splitSubPathIdx2].getCommandStates();
    let updatedSplitSubPaths: SubPathState[] = [];
    if (pssps.length > 2) {
      // In addition to deleting the split segment, we will also have to merge its
      // two adjacent sub paths together into one.
      const parentBackingId2 = _.last(splitCss2)
        .getParentCommandState()
        .getBackingId();
      const parentBackingCmd2 = _.find(pcss, c => parentBackingId2 === c.getBackingId());

      const newCss: CommandState[] = [];
      let cs: CommandState;
      let i = 0;
      for (; i < splitCss1.length; i++) {
        cs = splitCss1[i];
        if (splitCss1[i + 1].getSplitSegmentId() === targetSplitSegId) {
          // Iterate until we reach the location of the first split.
          break;
        }
        newCss.push(cs);
      }
      const parentBackingCmdIdx1 = i;
      if (cs.getBackingId() === splitCss2[1].getBackingId()) {
        newCss.push(splitCss2[1].merge(cs));
      } else {
        newCss.push(cs);
        newCss.push(splitCss2[1]);
      }
      cs = undefined;
      for (i = 2; i < splitCss2.length - 1; i++) {
        cs = splitCss2[i];
        if (splitCss2[i + 1].getSplitSegmentId() === targetSplitSegId) {
          // Iterate until we reach the location of the second split.
          break;
        }
        newCss.push(cs);
      }
      i = _.findIndex(splitCss1, c => c.getBackingId() === parentBackingCmd2.getBackingId());
      if (i >= 0) {
        if (cs) {
          if (splitCss1[i].getBackingId() === cs.getBackingId()) {
            // If the split created a new point, then merge the left/right commands
            // together to reconstruct the previous state.
            newCss.push(splitCss1[i].merge(cs));
          } else if (cs) {
            // If the split was done at an existing point, then simply push the next
            // command state onto the list.
            newCss.push(cs);
          }
        }
      } else {
        i = parentBackingCmdIdx1 + 1;
        if (cs) {
          newCss.push(cs);
        }
      }
      for (i = i + 1; i < splitCss1.length; i++) {
        newCss.push(splitCss1[i]);
      }
      const splits = [...pssps];
      splits[splitSubPathIdx1] = new SubPathState([...newCss])
        .mutate()
        .setId(targetSpsId)
        .build();
      splits.splice(splitSubPathIdx2, 1);
      updatedSplitSubPaths = splits;
    }
    const mutator = psps.mutate().setSplitSubPaths(updatedSplitSubPaths);
    const firstSplitSegId = _.last(splitCss2[0].getParentCommandState().getCommands()).getId();
    const secondSplitSegId = _.last(
      _.last(splitCss2)
        .getParentCommandState()
        .getCommands(),
    ).getId();
    for (const id of [firstSplitSegId, secondSplitSegId]) {
      this.deleteSpsSplitPoint(pcss, id, mutator);
    }
    this.subPathStateMap = this.replaceSubPathStateNode(
      psps,
      (states, i) => (states[i] = mutator.build()),
    );
    for (const idx of deletedSubIdxs) {
      this.updateOrderingAfterUnsplitSubPath(idx);
    }
    return this;
  }

  /**
   * Calculates the sub path indices that will be removed after unsplitting subIdx.
   * targetCs is the command state object containing the split segment in question.
   */
  private calculateDeletedSubIdxs(subIdx: number, targetCs: CommandState) {
    const splitSegId = targetCs.getSplitSegmentId();
    const psps = this.findSplitSegmentParentNode(splitSegId);
    const pssps = psps.getSplitSubPaths();
    const splitSubPathIdx1 = _.findIndex(pssps, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const splitSubPathIdx2 = _.findLastIndex(pssps, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const pssp1 = pssps[splitSubPathIdx1];
    const pssp2 = pssps[splitSubPathIdx2];
    const deletedSps = [...flattenSubPathStates([pssp1]), ...flattenSubPathStates([pssp2])];
    const spss = flattenSubPathStates(this.subPathStateMap);
    return deletedSps
      .slice(1)
      .map(sps => this.subPathOrdering[spss.indexOf(sps)])
      .sort((a, b) => b - a);
  }

  private deleteSpsSplitPoint(
    css: ReadonlyArray<CommandState>,
    splitCmdId: string,
    mutator: SubPathStateMutator,
  ) {
    let csIdx = 0,
      splitIdx = -1;
    for (; csIdx < css.length; csIdx++) {
      const cs = css[csIdx];
      const csIds = cs.getCommands().map((unused, idx) => cs.getIdAtIndex(idx));
      splitIdx = csIds.indexOf(splitCmdId);
      if (splitIdx >= 0) {
        break;
      }
    }
    if (splitIdx >= 0 && css[csIdx].isSplitAtIndex(splitIdx)) {
      // Delete the split point that created the sub path.
      const unsplitCs = css[csIdx]
        .mutate()
        .unsplitAtIndex(splitIdx)
        .build();
      mutator.setCommandState(csIdx, unsplitCs);
    }
  }

  private updateOrderingAfterUnsplitSubPath(subIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    this.subPathOrdering.splice(subIdx, 1);
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (spsIdx < this.subPathOrdering[i]) {
        this.subPathOrdering[i]--;
      }
    }
  }

  /**
   * Adds a collapsing subpath to the path.
   */
  addCollapsingSubPath(point: Point, numCommands: number) {
    const prevCmd = _.last(this.buildOrderedCommands());
    const css = [new CommandState(new Command('M', [prevCmd.getEnd(), point]))];
    for (let i = 1; i < numCommands; i++) {
      css.push(new CommandState(new Command('L', [point, point])));
    }
    this.subPathStateMap.push(new SubPathState(css));
    this.subPathOrdering.push(this.subPathOrdering.length);
    this.numCollapsingSubPaths++;
    return this;
  }

  /**
   * Deletes all collapsing subpaths from the path.
   */
  deleteCollapsingSubPaths() {
    const numSubPathsBeforeDelete = this.subPathOrdering.length;
    const spsIdxToSubIdxMap: number[] = [];
    for (let spsIdx = 0; spsIdx < numSubPathsBeforeDelete; spsIdx++) {
      spsIdxToSubIdxMap.push(this.subPathOrdering.indexOf(spsIdx));
    }
    const numCollapsingSubPathsBeforeDelete = this.numCollapsingSubPaths;
    const numSubPathsAfterDelete = numSubPathsBeforeDelete - numCollapsingSubPathsBeforeDelete;
    function deleteCollapsingSubPathInfoFn<T>(arr: T[]) {
      arr.splice(numSubPathsAfterDelete, numCollapsingSubPathsBeforeDelete);
    }
    for (let i = 0; i < numCollapsingSubPathsBeforeDelete; i++) {
      this.subPathStateMap.pop();
    }
    deleteCollapsingSubPathInfoFn(spsIdxToSubIdxMap);
    this.subPathOrdering = [];
    for (let subIdx = 0; subIdx < numSubPathsBeforeDelete; subIdx++) {
      for (let i = 0; i < spsIdxToSubIdxMap.length; i++) {
        if (spsIdxToSubIdxMap[i] === subIdx) {
          this.subPathOrdering.push(i);
          break;
        }
      }
    }
    this.numCollapsingSubPaths = 0;
    return this;
  }

  /**
   * Returns the initial starting state of this path.
   */
  revert() {
    this.deleteCollapsingSubPaths();
    this.subPathStateMap = this.subPathStateMap.map(sps => sps.revert());
    this.subPathOrdering = this.subPathStateMap.map((unused, i) => i);
    return this;
  }

  /**
   * Builds a new mutated path.
   */
  build() {
    return new Path(
      new PathState(
        this.buildOrderedCommands(),
        this.subPathStateMap,
        this.subPathOrdering,
        this.numCollapsingSubPaths,
      ),
    );
  }

  private buildOrderedCommands() {
    const spsCmds = flattenSubPathStates(this.subPathStateMap).map(sps =>
      reverseAndShiftCommands(sps),
    );
    const orderedSubPathCmds = this.subPathOrdering.map(
      (unused, subIdx) => spsCmds[this.subPathOrdering[subIdx]],
    );
    return _(orderedSubPathCmds)
      .map((cmds, subIdx) => {
        const moveCmd = cmds[0];
        if (subIdx === 0 && moveCmd.getStart()) {
          cmds[0] = moveCmd
            .mutate()
            .setPoints(undefined, moveCmd.getEnd())
            .build();
        } else if (subIdx !== 0) {
          const start = _.last(orderedSubPathCmds[subIdx - 1]).getEnd();
          cmds[0] = moveCmd
            .mutate()
            .setPoints(start, moveCmd.getEnd())
            .build();
        }
        return cmds;
      })
      .flatMap(cmds => cmds)
      .value();
  }

  /**
   * Returns the leaf node at the specified subpath index.
   */
  private findSubPathStateLeaf(subIdx: number) {
    return flattenSubPathStates(this.subPathStateMap)[this.subPathOrdering[subIdx]];
  }

  /**
   * Replaces the leaf node at the specified subpath index.
   */
  private setSubPathStateLeaf(subIdx: number, newState: SubPathState) {
    this.subPathStateMap = this.replaceSubPathStateNode(
      this.findSubPathStateLeaf(subIdx),
      (states, i) => (states[i] = newState),
    );
  }

  /**
   * Returns the immediate parent of the leaf node at the specified subpath index.
   */
  private findSubPathStateParent(subIdx: number) {
    const subPathStateParents: SubPathState[] = [];
    (function recurseFn(currentLevel: ReadonlyArray<SubPathState>, parent?: SubPathState) {
      currentLevel.forEach(state => {
        if (!state.getSplitSubPaths().length) {
          subPathStateParents.push(parent);
          return;
        }
        recurseFn(state.getSplitSubPaths(), state);
      });
    })(this.subPathStateMap);
    return subPathStateParents[this.subPathOrdering[subIdx]];
  }

  /**
   * Returns the command state indices associated with the specified command index.
   * The targetCs is the command state object that contains the command. The csIdx
   * is the index in the sub path state's list of command state objects that points
   * to targetCs. The splitIdx is the index into the targetCs pointing to the command.
   * This method should only be used during sub path splitting. All other methods should
   * use the findReversedAndShiftedInternalIndices() method below.
   */
  private findInternalIndices(css: ReadonlyArray<CommandState>, cmdIdx: number) {
    let counter = 0;
    let csIdx = 0;
    for (const targetCs of css) {
      if (counter + targetCs.getCommands().length > cmdIdx) {
        return { targetCs, csIdx, splitIdx: cmdIdx - counter };
      }
      counter += targetCs.getCommands().length;
      csIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }

  /**
   * Same as above, except this method first takes reversals and shift offsets
   * into account.
   */
  private findReversedAndShiftedInternalIndices(subIdx: number, cmdIdx: number) {
    const sps = this.findSubPathStateLeaf(subIdx);
    const css = sps.getCommandStates();
    const numCommandsInSubPath = _.sumBy(css, cs => cs.getCommands().length);
    if (cmdIdx && sps.isReversed()) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.getShiftOffset();
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting (numCommandsInSubPath - 1) is intentional here
      // (as opposed to subtracting numCommandsInSubPath).
      cmdIdx -= numCommandsInSubPath - 1;
    }
    return this.findInternalIndices(css, cmdIdx);
  }

  /**
   * Replaces a node in the sub path state map. Note that this function uses
   * object equality to determine the location of the node in the tree.
   */
  private replaceSubPathStateNode(
    nodeToReplace: SubPathState,
    replaceNodeFn: (states: SubPathState[], i: number) => void,
  ) {
    return (function recurseFn(states: SubPathState[]) {
      if (!states.length) {
        return undefined;
      }
      for (let i = 0; i < states.length; i++) {
        const currentState = states[i];
        if (currentState === nodeToReplace) {
          replaceNodeFn(states, i);
          return states;
        }
        const recurseStates = recurseFn([...currentState.getSplitSubPaths()]);
        if (recurseStates) {
          states[i] = currentState
            .mutate()
            .setSplitSubPaths(recurseStates)
            .build();
          return states;
        }
      }
      // Return undefined to signal that the parent was not found.
      return undefined;
    })([...this.subPathStateMap]);
  }

  /**
   * Finds the first node in the tree that contains the specified split segment ID.
   */
  private findSplitSegmentParentNode(splitSegId: string): SubPathState {
    return (function recurseFn(...states: SubPathState[]): SubPathState {
      for (const state of states) {
        for (const sps of state.getSplitSubPaths()) {
          if (sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId)) {
            return state;
          }
          const parent = recurseFn(sps);
          if (parent) {
            return parent;
          }
        }
      }
      return undefined;
    })(...this.subPathStateMap);
  }
}

/**
 * Returns a list of shifted and reversed command state objects. Used during
 * subpath splitting when creating new children split subpaths.
 */
function reverseAndShiftCommandStates(
  css: ReadonlyArray<CommandState>,
  isReversed: boolean,
  shiftOffset: number,
) {
  // If the last command is a 'Z', replace it with a line before we shift.
  // TODO: replacing the 'Z' messes up certain stroke-linejoin values
  const newCss = [...css];
  newCss[newCss.length - 1] = _.last(css)
    .mutate()
    .forceConvertClosepathsToLines()
    .build();
  return shiftCommandStates(reverseCommandStates(newCss, isReversed), isReversed, shiftOffset);
}

/**
 * Returns a list of reversed command state objects.
 */
function reverseCommandStates(css: CommandState[], isReversed: boolean) {
  if (isReversed) {
    const revCss = [
      new CommandState(
        new Command('M', [
          css[0].getCommands()[0].getStart(),
          _.last(_.last(css).getCommands()).getEnd(),
        ]),
      ),
    ];
    for (let i = css.length - 1; i > 0; i--) {
      revCss.push(
        css[i]
          .mutate()
          .reverse()
          .build(),
      );
    }
    css = revCss;
  }
  return css;
}

/**
 * Returns a list of shifted command state objects.
 */
function shiftCommandStates(css: CommandState[], isReversed: boolean, shiftOffset: number) {
  if (!shiftOffset || css.length === 1) {
    return css;
  }

  const numCommands = _.sumBy(css, cs => cs.getCommands().length);
  if (isReversed) {
    shiftOffset *= -1;
    shiftOffset += numCommands - 1;
  }
  const newCss: CommandState[] = [];

  let counter = 0;
  let targetCsIdx: number;
  let targetSplitIdx: number;
  let targetCs: CommandState;
  for (let i = 0; i < css.length; i++) {
    const cs = css[i];
    const size = cs.getCommands().length;
    if (counter + size <= shiftOffset) {
      counter += size;
      continue;
    }
    targetCs = cs;
    targetCsIdx = i;
    targetSplitIdx = shiftOffset - counter;
    break;
  }

  newCss.push(
    new CommandState(
      new Command('M', [
        css[0].getCommands()[0].getStart(),
        targetCs.getCommands()[targetSplitIdx].getEnd(),
      ]),
    ),
  );
  const { left, right } = targetCs.slice(targetSplitIdx);
  if (right) {
    newCss.push(right);
  }
  for (let i = targetCsIdx + 1; i < css.length; i++) {
    newCss.push(css[i]);
  }
  for (let i = 1; i < targetCsIdx; i++) {
    newCss.push(css[i]);
  }
  newCss.push(left);
  return newCss;
}

/**
 * Returns a list of reversed and shifted commands.
 */
function reverseAndShiftCommands(subPathState: SubPathState) {
  return shiftCommands(subPathState, reverseCommands(subPathState));
}

/**
 * Returns a list of reversed commands.
 */
function reverseCommands(subPathState: SubPathState) {
  const subPathCss = subPathState.getCommandStates();
  const hasOneCmd = subPathCss.length === 1 && subPathCss[0].getCommands().length === 1;
  if (hasOneCmd || !subPathState.isReversed()) {
    // Nothing to do in these two cases.
    return _.flatMap(subPathCss, cm => cm.getCommands() as Command[]);
  }

  // Extract the commands from our command mutation map.
  const cmds = _.flatMap(subPathCss, cm => {
    // Consider a segment A ---- B ---- C with AB split and
    // BC non-split. When reversed, we want the user to see
    // C ---- B ---- A w/ CB split and BA non-split.
    const cmCmds = [...cm.getCommands()];
    if (cmCmds[0].getSvgChar() === 'M') {
      return cmCmds;
    }
    cmCmds[0] = cmCmds[0]
      .mutate()
      .toggleSplitPoint()
      .build();
    cmCmds[cmCmds.length - 1] = cmCmds[cmCmds.length - 1]
      .mutate()
      .toggleSplitPoint()
      .build();
    return cmCmds;
  });

  // If the last command is a 'Z', replace it with a line before we reverse.
  // TODO: replacing the 'Z' messes up certain stroke-linejoin values
  const lastCmd = _.last(cmds);
  if (lastCmd.getSvgChar() === 'Z') {
    cmds[cmds.length - 1] = lastCmd
      .mutate()
      .setSvgChar('L')
      .setPoints(...lastCmd.getPoints())
      .build();
  }

  // Reverse the commands.
  const newCmds: Command[] = [];
  for (let i = cmds.length - 1; i > 0; i--) {
    newCmds.push(
      cmds[i]
        .mutate()
        .reverse()
        .build(),
    );
  }
  newCmds.unshift(
    cmds[0]
      .mutate()
      .setPoints(cmds[0].getStart(), newCmds[0].getStart())
      .build(),
  );
  return newCmds;
}

/**
 * Returns a list of shifted commands.
 */
function shiftCommands(subPathState: SubPathState, cmds: Command[]) {
  let shiftOffset = subPathState.getShiftOffset();
  if (
    !shiftOffset ||
    cmds.length === 1 ||
    !MathUtil.arePointsEqual(_.first(cmds).getEnd(), _.last(cmds).getEnd())
  ) {
    // If there is no shift offset, the sub path is one command long,
    // or if the sub path is not closed, then do nothing.
    return cmds;
  }

  const numCommands = cmds.length;
  if (subPathState.isReversed()) {
    shiftOffset *= -1;
    shiftOffset += numCommands - 1;
  }

  // If the last command is a 'Z', replace it with a line before we shift.
  const lastCmd = _.last(cmds);
  if (lastCmd.getSvgChar() === 'Z') {
    // TODO: replacing the 'Z' messes up certain stroke-linejoin values
    cmds[numCommands - 1] = lastCmd
      .mutate()
      .setSvgChar('L')
      .setPoints(...lastCmd.getPoints())
      .build();
  }

  const newCmds: Command[] = [];

  // Handle these case separately cause they are annoying and I'm sick of edge cases.
  if (shiftOffset === 1) {
    newCmds.push(
      cmds[0]
        .mutate()
        .setPoints(cmds[0].getStart(), cmds[1].getEnd())
        .build(),
    );
    for (let i = 2; i < cmds.length; i++) {
      newCmds.push(cmds[i]);
    }
    newCmds.push(cmds[1]);
    return newCmds;
  } else if (shiftOffset === numCommands - 1) {
    newCmds.push(
      cmds[0]
        .mutate()
        .setPoints(cmds[0].getStart(), cmds[numCommands - 2].getEnd())
        .build(),
    );
    newCmds.push(_.last(cmds));
    for (let i = 1; i < cmds.length - 1; i++) {
      newCmds.push(cmds[i]);
    }
    return newCmds;
  }

  // Shift the sequence of commands. After the shift, the original move
  // command will be at index 'numCommands - shiftOffset'.
  for (let i = 0; i < numCommands; i++) {
    newCmds.push(cmds[(i + shiftOffset) % numCommands]);
  }

  // The first start point will either be undefined,
  // or the end point of the previous sub path.
  const prevMoveCmd = newCmds.splice(numCommands - shiftOffset, 1)[0];
  newCmds.push(newCmds.shift());
  newCmds.unshift(
    cmds[0]
      .mutate()
      .setPoints(prevMoveCmd.getStart(), _.last(newCmds).getEnd())
      .build(),
  );
  return newCmds;
}

function LOG(...args: any[]) {
  if (ENABLE_LOGS) {
    const [obj, ...objs] = args;
    // tslint:disable-next-line: no-console
    console.info(obj, ...objs);
  }
}
