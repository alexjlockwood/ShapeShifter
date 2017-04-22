import * as _ from 'lodash';
import { SvgChar, Command, newPath } from '.';
import { newCommand } from './CommandImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';
import {
  SubPathState,
  SubPathStateMutator,
  flattenSubPathStates,
  findSplitSegmentParentNode,
} from './SubPathState';
import { environment } from '../../../environments/environment';

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
    this.subPathStateMap = ps.subPathStateMap.slice();
    this.subPathOrdering = ps.subPathOrdering.slice();
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    LOG('reverseSubPath', subIdx);
    this.setSubPathStateLeaf(
      subIdx, this.findSubPathStateLeaf(subIdx).mutate().reverse().build());
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
    const numCommandsInSubPath =
      _.sumBy(sps.getCommandStates(), cs => cs.getCommands().length);
    if (numCommandsInSubPath <= 1) {
      return this;
    }
    const firstCmd = sps.getCommandStates()[0].getCommands()[0];
    const lastCmd = _.last(_.last(sps.getCommandStates()).getCommands());
    if (!firstCmd.getEnd().equals(lastCmd.getEnd())) {
      // TODO: in some cases there may be rounding errors that cause a closed subpath
      // to show up as non-closed. is there anything we can do to alleviate this?
      console.warn('Ignoring attempt to shift a non-closed subpath');
      return this;
    }
    this.setSubPathStateLeaf(
      subIdx,
      sps.mutate()
        .setShiftOffset(calcOffsetFn(sps.getShiftOffset(), numCommandsInSubPath))
        .build());
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
    const { targetCs, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(subIdx, csIdx, ts.length);
    const sps = this.findSubPathStateLeaf(subIdx);
    if (sps.isReversed()) {
      ts = ts.map(t => 1 - t);
    }
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx).mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(csIdx, targetCs.mutate().splitAtIndex(splitIdx, ts).build())
        .build());
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    LOG('splitCommandInHalf', subIdx, cmdIdx);
    const { targetCs, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const shiftOffset = this.getUpdatedShiftOffsetsAfterSplit(subIdx, csIdx, 1);
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx).mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(csIdx, targetCs.mutate().splitInHalfAtIndex(splitIdx).build())
        .build());
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
    const { targetCs, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const isSubPathReversed = this.findSubPathStateLeaf(subIdx).isReversed();
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx).mutate()
        .setCommandState(csIdx, targetCs.mutate()
          .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
          .build())
        .build());
    const shiftOffset = this.findSubPathStateLeaf(subIdx).getShiftOffset();
    if (shiftOffset && csIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.setSubPathStateLeaf(
        subIdx,
        this.findSubPathStateLeaf(subIdx).mutate()
          .setShiftOffset(shiftOffset - 1)
          .build());
    }
    return this;
  }

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCs, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    this.setSubPathStateLeaf(
      subIdx,
      this.findSubPathStateLeaf(subIdx).mutate()
        .setCommandState(csIdx, targetCs.mutate()
          .convertAtIndex(splitIdx, svgChar)
          .build())
        .build());
    return this;
  }

  /**
   * Reverts any conversions previously performed in the specified sub path.
   */
  unconvertSubPath(subIdx: number) {
    const sps = this.findSubPathStateLeaf(subIdx);
    const commandStates =
      sps.getCommandStates().map((cs, csIdx) => {
        return csIdx === 0 ? cs : cs.mutate().unconvertSubpath().build();
      });
    this.setSubPathStateLeaf(subIdx, sps.mutate().setCommandStates(commandStates).build());
    return this;
  }

  /**
   * Adds transforms on the path using the specified transformation matrices.
   */
  addTransforms(transforms: Matrix[]) {
    return this.applyTransforms(
      transforms, cs => cs.mutate().addTransforms(transforms).build());
  }

  /**
   * Sets transforms on the path using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    return this.applyTransforms(
      transforms, cs => cs.mutate().setTransforms(transforms).build());
  }

  private applyTransforms(transforms: Matrix[], applyFn: (cs: CommandState) => CommandState) {
    const subPathStates = flattenSubPathStates(this.subPathStateMap);
    for (let spsIdx = 0; spsIdx < subPathStates.length; spsIdx++) {
      const sps = subPathStates[spsIdx];
      this.setSubPathStateLeaf(
        this.subPathOrdering.indexOf(spsIdx),
        sps.mutate()
          .setCommandStates(sps.getCommandStates().map(cs => applyFn(cs)))
          .build());
    }
    return this;
  }

  /**
   * Moves a subpath from one index to another. Returns a new path object.
   */
  moveSubPath(fromSubIdx: number, toSubIdx: number) {
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
    const css =
      reverseAndShiftCommandStates(
        sps.getCommandStates(), sps.isReversed(), sps.getShiftOffset());
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
        let endMoveCs = new CommandState(newCommand('M', [splitPoint, splitPoint]));
        if (sps.isReversed()) {
          endMoveCs = endMoveCs.mutate().reverse().build();
        }
        endCommandStates.push(endMoveCs);
        if (right) {
          endCommandStates.push(right);
        }
      }
    }
    const splitSubPaths = [
      // TODO: should/could one of these sub paths share the same ID as the parent?
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    this.setSubPathStateLeaf(
      subIdx, sps.mutate().setSplitSubPaths(splitSubPaths).build());
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
    const splitCmdId =
      _.last(_.last(parent.getSplitSubPaths()[0].getCommandStates()).getCommands()).getId();
    const mutator = parent.mutate().setSplitSubPaths([]);
    const parentCss = parent.getCommandStates();
    this.deleteSpsSplitPoint(parentCss, splitCmdId, mutator);
    this.subPathStateMap =
      this.replaceSubPathStateNode(
        this.findSubPathStateParent(subIdx),
        (states, i) => states[i] = mutator.build());
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
   *
   */
  splitFilledSubPath(subIdx: number, startCmdIdx: number, endCmdIdx: number) {
    LOG('splitFilledSubPath', subIdx, startCmdIdx, endCmdIdx);
    const targetSps = this.findSubPathStateLeaf(subIdx);
    const targetCss =
      reverseAndShiftCommandStates(
        targetSps.getCommandStates(),
        targetSps.isReversed(),
        targetSps.getShiftOffset());

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
        endSplitIdx: e.splitIdx
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

    // Give both line segments a unique ID so that we can later identify which
    // split segments were added together.
    const splitSegmentId = _.uniqueId();
    const endLine =
      new CommandState(newCommand('L', [endSplitPoint, startSplitPoint]))
        .mutate().setSplitSegmentInfo(secondLeft, splitSegmentId).build();
    const startLine =
      new CommandState(newCommand('L', [startSplitPoint, endSplitPoint]))
        .mutate().setSplitSegmentInfo(firstLeft, splitSegmentId).build();

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
          new CommandState(newCommand('M', [startSplitPoint, startSplitPoint]))
            .mutate()
            // The move command identifies the beginning of a new split segment,
            // so we'll mark it with the parent state as well (we'll need this
            // information later on if the segment is deleted). Note that unlike
            // the two segments above, we don't need to specify an ID here.
            .setSplitSegmentInfo(firstLeft, '')
            .build());
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
    const parentSplitSegIds =
      _.chain((parent ? parent.getCommandStates() : []))
        .flatMap(css => css)
        .filter(cs => !!cs.getSplitSegmentId())
        .map(cs => cs.getBackingId())
        .value();
    const splitSegCssIds =
      _.chain(targetSps.getCommandStates())
        .filter(cs => !!cs.getSplitSegmentId() && !parentSplitSegIds.includes(cs.getBackingId()))
        .map(cs => cs.getBackingId())
        .value();
    // Checking for the existence of 'firstRight' and 'secondRight' ensures that
    // paths connected to the end point of a deleted split segment will still be kept.
    if (this.subPathStateMap.includes(targetSps)
      || (firstRight && splitSegCssIds.includes(firstLeft.getBackingId()))
      || (secondRight && splitSegCssIds.includes(secondLeft.getBackingId()))) {
      // If we are at the first level of the tree or if one of the new
      // split edges is a split segment, then add a new level of the tree
      // (if the already existing split segment is deleted, we want to
      // delete the split segment we are creating right now as well).
      newStates.push(
        targetSps.mutate()
          .setSplitSubPaths(splitSubPaths)
          .build());
    } else {
      // Otherwise insert the sub paths in the current level of the tree.
      newStates.push(...splitSubPaths);
    }

    // Insert the new SubPathStates into the tree.
    this.subPathStateMap =
      this.replaceSubPathStateNode(
        targetSps,
        (states, i) => states.splice(i, 1, ...newStates));
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
  * Deletes the filled subpath at the specified index. The subpath's siblings
  * will be deleted as well.
  */
  deleteFilledSubPath(subIdx: number) {
    LOG('deleteFilledSubPath', subIdx);
    const splitSegIds = new Set<string>(
      _.chain(this.findSubPathStateLeaf(subIdx).getCommandStates())
        .map(cs => cs.getSplitSegmentId())
        .filter(id => !!id)
        .value()
    );
    splitSegIds.forEach(id => {
      const targetSps = this.findSubPathStateLeaf(subIdx);
      const targetCs =
        _.find(targetSps.getCommandStates(), cs => cs.getSplitSegmentId() === id);
      const deletedSubIdxs = this.calculateDeletedSubIdxs(subIdx, targetCs);
      this.deleteSubPathSplitSegmentInternal(subIdx, targetCs);
      subIdx -= _.sumBy(deletedSubIdxs, idx => idx <= subIdx ? 1 : 0);
    });
    return this;
  }

  /**
   * Deletes the sub path split segment with the specified index.
   */
  deleteSubPathSplitSegment(subIdx: number, cmdIdx: number) {
    LOG('deleteSubPathSplitSegment', subIdx, cmdIdx);
    const { targetCs } = this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    this.deleteSubPathSplitSegmentInternal(subIdx, targetCs);
  }

  /**
   * Deletes the sub path split segment with the specified index.
   */
  private deleteSubPathSplitSegmentInternal(subIdx: number, targetCs: CommandState) {
    const targetSpsId = this.findSubPathStateLeaf(subIdx).getId();
    const splitSegId = targetCs.getSplitSegmentId();
    const parentSps = findSplitSegmentParentNode(this.subPathStateMap, splitSegId);
    const parentSplitSubPaths = parentSps.getSplitSubPaths();
    const parentCss = parentSps.getCommandStates();
    const splitSubPathIdx1 = _.findIndex(parentSplitSubPaths, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const splitSubPathIdx2 = _.findLastIndex(parentSplitSubPaths, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const deletedSubIdxs = this.calculateDeletedSubIdxs(subIdx, targetCs);
    let updatedSplitSubPaths: SubPathState[] = [];
    const splitCss1 = parentSplitSubPaths[splitSubPathIdx1].getCommandStates();
    const splitCss2 = parentSplitSubPaths[splitSubPathIdx2].getCommandStates();
    if (parentSplitSubPaths.length > 2) {
      const parentBackingId1 = splitCss2[0].getParentCommandState().getBackingId();
      const parentBackingId2 = _.last(splitCss2).getParentCommandState().getBackingId();
      const parentBackingCmd1 = _.find(parentCss, cs => parentBackingId1 === cs.getBackingId());
      const parentBackingCmd2 = _.find(parentCss, cs => parentBackingId2 === cs.getBackingId());

      const newCss: CommandState[] = [];
      let cs: CommandState;
      let i = 0;
      for (; i < splitCss1.length; i++) {
        cs = splitCss1[i];
        if ((i + 1 < splitCss1.length && splitCss1[i + 1].getSplitSegmentId() === splitSegId)
          || cs.getBackingId() === parentBackingCmd1.getBackingId()) {
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
      for (i = 2; i < splitCss2.length; i++) {
        cs = splitCss2[i];
        if (cs.getBackingId() === parentBackingCmd2.getBackingId()) {
          break;
        }
        newCss.push(cs);
      }
      i = _.findIndex(splitCss1, c => c.getBackingId() === parentBackingCmd2.getBackingId());
      if (i >= 0) {
        newCss.push(splitCss1[i].merge(cs));
      } else {
        i = parentBackingCmdIdx1 + 1;
        newCss.push(cs);
      }
      for (i = i + 1; i < splitCss1.length; i++) {
        newCss.push(splitCss1[i]);
      }
      const splits = parentSplitSubPaths.slice();
      splits[splitSubPathIdx1] =
        new SubPathState(newCss.slice()).mutate().setId(targetSpsId).build();
      splits.splice(splitSubPathIdx2, 1);
      updatedSplitSubPaths = splits;
    }
    const mutator = parentSps.mutate().setSplitSubPaths(updatedSplitSubPaths);
    const firstSplitSegId = _.last(splitCss2[0].getParentCommandState().getCommands()).getId();
    const secondSplitSegId = _.last(_.last(splitCss2).getParentCommandState().getCommands()).getId();
    for (const id of [firstSplitSegId, secondSplitSegId]) {
      this.deleteSpsSplitPoint(parentCss, id, mutator);
    }
    this.subPathStateMap =
      this.replaceSubPathStateNode(
        parentSps,
        (states, i) => states[i] = mutator.build());
    for (const idx of deletedSubIdxs) {
      this.updateOrderingAfterUnsplitSubPath(idx);
    }
    return this;
  }

  private calculateDeletedSubIdxs(subIdx: number, targetCs: CommandState) {
    const splitSegId = targetCs.getSplitSegmentId();
    const parentSps = findSplitSegmentParentNode(this.subPathStateMap, splitSegId);
    const parentSplitSubPaths = parentSps.getSplitSubPaths();
    const splitSubPathIdx1 = _.findIndex(parentSplitSubPaths, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const splitSubPathIdx2 = _.findLastIndex(parentSplitSubPaths, sps => {
      return sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegId);
    });
    const splitSubPath1 = parentSplitSubPaths[splitSubPathIdx1];
    const splitSubPath2 = parentSplitSubPaths[splitSubPathIdx2];
    const deletedSps =
      flattenSubPathStates([splitSubPath1])
        .concat(flattenSubPathStates([splitSubPath2]));
    const flattenedSps = flattenSubPathStates(this.subPathStateMap);
    return deletedSps.slice(1)
      .map(sps => this.subPathOrdering[flattenedSps.indexOf(sps)])
      .sort((a, b) => b - a);
  }

  private deleteSpsSplitPoint(
    css: ReadonlyArray<CommandState>,
    splitCmdId: string,
    mutator: SubPathStateMutator) {

    let csIdx = 0, splitIdx = -1;
    for (; csIdx < css.length; csIdx++) {
      const cs = css[csIdx];
      const csIds = cs.getCommands().map((_, idx) => cs.getIdAtIndex(idx));
      splitIdx = csIds.indexOf(splitCmdId);
      if (splitIdx >= 0) {
        break;
      }
    }
    if (splitIdx >= 0 && css[csIdx].isSplitAtIndex(splitIdx)) {
      // Delete the split point that created the sub path.
      const unsplitCs = css[csIdx].mutate().unsplitAtIndex(splitIdx).build();
      mutator.setCommandState(csIdx, unsplitCs);
    }
  }

  private updateOrderingAfterUnsplitSubPath(subIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    this.subPathOrdering.splice(subIdx, 1);
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
    const css = [new CommandState(newCommand('M', [prevCmd.getEnd(), point]))];
    for (let i = 1; i < numCommands; i++) {
      css.push(new CommandState(newCommand('L', [point, point])));
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
    const numSubPathsAfterDelete =
      numSubPathsBeforeDelete - numCollapsingSubPathsBeforeDelete;
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
    this.subPathOrdering = this.subPathStateMap.map((_, i) => i);
    return this;
  }

  /**
   * Builds a new mutated path.
   */
  build() {
    return newPath(
      new PathState(
        this.buildOrderedCommands(),
        this.subPathStateMap,
        this.subPathOrdering,
        this.numCollapsingSubPaths,
      ));
  }

  private buildOrderedCommands() {
    const spsCmds =
      flattenSubPathStates(this.subPathStateMap).map(sps => reverseAndShiftCommands(sps));
    const orderedSubPathCmds =
      this.subPathOrdering.map((_, subIdx) => spsCmds[this.subPathOrdering[subIdx]]);
    return _.chain(orderedSubPathCmds)
      .map((cmds: Command[], subIdx: number) => {
        const moveCmd = cmds[0];
        if (subIdx === 0 && moveCmd.getStart()) {
          cmds[0] = moveCmd.mutate().setPoints(undefined, moveCmd.getEnd()).build();
        } else if (subIdx !== 0) {
          const start = _.last(orderedSubPathCmds[subIdx - 1]).getEnd();
          cmds[0] = moveCmd.mutate().setPoints(start, moveCmd.getEnd()).build();
        }
        return cmds;
      })
      .flatten<Command>()
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
    this.subPathStateMap =
      this.replaceSubPathStateNode(
        this.findSubPathStateLeaf(subIdx),
        (states, i) => states[i] = newState);
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
    replaceNodeFn: (states: SubPathState[], i: number) => void) {

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
        const recurseStates = recurseFn(currentState.getSplitSubPaths().slice());
        if (recurseStates) {
          states[i] = currentState.mutate().setSplitSubPaths(recurseStates).build();
          return states;
        }
      }
      // Return undefined to signal that the parent was not found.
      return undefined;
    })(this.subPathStateMap.slice());
  }
}

/**
 * Returns a list of shifted and reversed command state objects. Used during
 * subpath splitting when creating new children split subpaths.
 */
function reverseAndShiftCommandStates(
  css: ReadonlyArray<CommandState>,
  isReversed: boolean,
  shiftOffset: number) {

  // If the last command is a 'Z', replace it with a line before we shift.
  // TODO: replacing the 'Z' messes up certain stroke-linejoin values
  const newCss = css.slice();
  newCss[newCss.length - 1] = _.last(css).mutate().forceConvertClosepathsToLines().build();
  return shiftCommandStates(reverseCommandStates(newCss, isReversed), isReversed, shiftOffset);
}

/**
 * Returns a list of reversed command state objects.
 */
function reverseCommandStates(css: CommandState[], isReversed: boolean) {
  if (isReversed) {
    const revCss = [
      new CommandState(
        newCommand('M', [
          css[0].getCommands()[0].getStart(),
          _.last(_.last(css).getCommands()).getEnd(),
        ])),
    ];
    for (let i = css.length - 1; i > 0; i--) {
      revCss.push(css[i].mutate().reverse().build());
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
  let targetCsIdx: number = undefined;
  let targetSplitIdx: number = undefined;
  let targetCs: CommandState = undefined;
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
      newCommand('M', [
        css[0].getCommands()[0].getStart(),
        targetCs.getCommands()[targetSplitIdx].getEnd(),
      ])));
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
  const hasOneCmd =
    subPathCss.length === 1 && subPathCss[0].getCommands().length === 1;
  if (hasOneCmd || !subPathState.isReversed()) {
    // Nothing to do in these two cases.
    return _.flatMap(subPathCss, cm => cm.getCommands() as Command[]);
  }

  // Extract the commands from our command mutation map.
  const cmds = _.flatMap(subPathCss, cm => {
    // Consider a segment A ---- B ---- C with AB split and
    // BC non-split. When reversed, we want the user to see
    // C ---- B ---- A w/ CB split and BA non-split.
    const cmCmds = cm.getCommands().slice();
    if (cmCmds[0].getSvgChar() === 'M') {
      return cmCmds;
    }
    cmCmds[0] = cmCmds[0].mutate().toggleSplitPoint().build();
    cmCmds[cmCmds.length - 1] =
      cmCmds[cmCmds.length - 1].mutate().toggleSplitPoint().build();
    return cmCmds;
  });

  // If the last command is a 'Z', replace it with a line before we reverse.
  // TODO: replacing the 'Z' messes up certain stroke-linejoin values
  const lastCmd = _.last(cmds);
  if (lastCmd.getSvgChar() === 'Z') {
    cmds[cmds.length - 1] =
      lastCmd.mutate()
        .setSvgChar('L')
        .setPoints(...lastCmd.getPoints())
        .build();
  }

  // Reverse the commands.
  const newCmds: Command[] = [];
  for (let i = cmds.length - 1; i > 0; i--) {
    newCmds.push(cmds[i].mutate().reverse().build());
  }
  newCmds.unshift(
    cmds[0].mutate()
      .setPoints(cmds[0].getStart(), newCmds[0].getStart())
      .build());
  return newCmds;
}

/**
 * Returns a list of shifted commands.
 */
function shiftCommands(subPathState: SubPathState, cmds: Command[]) {
  let shiftOffset = subPathState.getShiftOffset();
  if (!shiftOffset
    || cmds.length === 1
    || !_.first(cmds).getEnd().equals(_.last(cmds).getEnd())) {
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
    cmds[numCommands - 1] =
      lastCmd.mutate()
        .setSvgChar('L')
        .setPoints(...lastCmd.getPoints())
        .build();
  }

  const newCmds: Command[] = [];

  // Handle these case separately cause they are annoying and I'm sick of edge cases.
  if (shiftOffset === 1) {
    newCmds.push(
      cmds[0].mutate()
        .setPoints(cmds[0].getStart(), cmds[1].getEnd())
        .build());
    for (let i = 2; i < cmds.length; i++) {
      newCmds.push(cmds[i]);
    }
    newCmds.push(cmds[1]);
    return newCmds;
  } else if (shiftOffset === numCommands - 1) {
    newCmds.push(
      cmds[0].mutate()
        .setPoints(cmds[0].getStart(), cmds[numCommands - 2].getEnd())
        .build());
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
    cmds[0].mutate()
      .setPoints(prevMoveCmd.getStart(), _.last(newCmds).getEnd())
      .build());
  return newCmds;
}

function LOG(...args: any[]) {
  if (ENABLE_LOGS) {
    const [obj, ...objs] = args;
    // tslint:disable-next-line
    console.info(obj, ...objs);
  }
}
