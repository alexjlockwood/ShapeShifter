import * as _ from 'lodash';
import { SvgChar, Command, newPath } from '.';
import { newCommand } from './CommandImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';
import {
  SubPathState,
  findSubPathState,
  flattenSubPathStates,
} from './SubPathState';

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
    const spsIdx = this.subPathOrdering[subIdx];
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate().reverse().build(), spsIdx);
    return this;
  }

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   */
  shiftSubPathBack(subIdx: number, numShifts = 1) {
    const spsIdx = this.subPathOrdering[subIdx];
    return this.findSubPathState(spsIdx).isReversed()
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    const spsIdx = this.subPathOrdering[subIdx];
    return this.findSubPathState(spsIdx).isReversed()
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const numCommandsInSubPath =
      _.sum(sps.getCommandStates().map(cm => cm.getCommands().length));
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
    this.setSubPathState(
      sps.mutate()
        .setShiftOffset(calcOffsetFn(sps.getShiftOffset(), numCommandsInSubPath))
        .build(),
      spsIdx);
    return this;
  }

  /**
   * Splits the command using the specified t values.
   */
  splitCommand(subIdx: number, cmdIdx: number, ...ts: number[]) {
    if (!ts.length) {
      throw new Error('Must specify at least one t value');
    }
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const shiftOffset =
      this.getUpdatedShiftOffsetsAfterSplit(spsIdx, csIdx, ts.length);
    const sps = this.findSubPathState(spsIdx);
    if (sps.isReversed()) {
      ts = ts.map(t => 1 - t);
    }
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(targetCs.mutate().splitAtIndex(splitIdx, ts).build(), csIdx)
        .build(),
      spsIdx);
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const shiftOffset =
      this.getUpdatedShiftOffsetsAfterSplit(spsIdx, csIdx, 1);
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate()
        .setShiftOffset(shiftOffset)
        .setCommandState(targetCs.mutate().splitInHalfAtIndex(splitIdx).build(), csIdx)
        .build(),
      spsIdx);
    return this;
  }

  // If 0 <= csIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private getUpdatedShiftOffsetsAfterSplit(spsIdx: number, csIdx: number, numSplits: number) {
    const sps = this.findSubPathState(spsIdx);
    if (sps.getShiftOffset() && csIdx <= sps.getShiftOffset()) {
      return sps.getShiftOffset() + numSplits;
    }
    return sps.getShiftOffset();
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    const isSubPathReversed = this.findSubPathState(spsIdx).isReversed();
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate()
        .setCommandState(targetCs.mutate()
          .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
          .build(), csIdx)
        .build(),
      spsIdx);
    const shiftOffset = this.findSubPathState(spsIdx).getShiftOffset();
    if (shiftOffset && csIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.setSubPathState(
        this.findSubPathState(spsIdx).mutate()
          .setShiftOffset(shiftOffset - 1)
          .build(),
        spsIdx);
    }
    return this;
  }

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate()
        .setCommandState(targetCs.mutate()
          .convertAtIndex(splitIdx, svgChar)
          .build(), csIdx)
        .build(),
      spsIdx);
    return this;
  }

  /**
   * Reverts any conversions previously performed in the specified sub path.
   */
  unconvertSubPath(subIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const commandStates =
      sps.getCommandStates().map((cs, csIdx) => {
        return csIdx === 0 ? cs : cs.mutate().unconvertSubpath().build();
      });
    this.setSubPathState(sps.mutate().setCommandStates(commandStates).build(), spsIdx);
    return this;
  }

  /**
   * Adds transforms on the path using the specified transformation matrices.
   */
  addTransforms(transforms: Matrix[]) {
    return this.applyTransforms(transforms, cs => cs.mutate().addTransforms(transforms).build());
  }

  /**
   * Sets transforms on the path using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    return this.applyTransforms(transforms, cs => cs.mutate().setTransforms(transforms).build());
  }

  private applyTransforms(transforms: Matrix[], applyFn: (cs: CommandState) => CommandState) {
    const subPathStates = flattenSubPathStates(this.subPathStateMap);
    for (let spsIdx = 0; spsIdx < subPathStates.length; spsIdx++) {
      const sps = subPathStates[spsIdx];
      this.setSubPathState(
        sps.mutate()
          .setCommandStates(sps.getCommandStates().map(cs => applyFn(cs)))
          .build(),
        spsIdx);
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
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const css = shiftAndReverseCommandStates(sps.getCommandStates(), sps.isReversed(), sps.getShiftOffset());
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
    this.setSubPathState(sps.mutate().setSplitSubPaths(splitSubPaths).build(), spsIdx);
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Splits a filled sub path using the specified indices.
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
   * Splitting the filled sub path with startCmdIdx=1 and endCmdIdx=4
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
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const css =
      shiftAndReverseCommandStates(
        sps.getCommandStates(),
        sps.isReversed(),
        sps.getShiftOffset());
    let start = this.findInternalIndices(css, startCmdIdx);
    let end = this.findInternalIndices(css, endCmdIdx);

    // Make sure the start index appears before the end index in the path.
    if (start.csIdx > end.csIdx || (start.csIdx === end.csIdx && start.splitIdx > end.csIdx)) {
      const temp = start;
      start = end;
      end = temp;
    }

    // firstLeft is the left portion of the first split segment (to use in the first split path).
    // secondLeft is the left portion of the second split segment (to use in the second split path).
    // firstRight is the right portion of the first split segment (to use in the second split path).
    // secondRight is the right portion of the second split segment (to use in the first split path).
    const { left: firstLeft, right: firstRight } = css[start.csIdx].slice(start.splitIdx);
    const { left: secondLeft, right: secondRight } = css[end.csIdx].slice(end.splitIdx);
    const startSplitCmd = firstLeft.getCommands()[start.splitIdx];
    const startSplitPoint = startSplitCmd.getEnd();
    const endSplitCmd = secondLeft.getCommands()[end.splitIdx];
    const endSplitPoint = endSplitCmd.getEnd();

    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    const endLineCmd =
      newCommand('L', [endSplitPoint, startSplitPoint]).mutate()
        .setIsSubPathSplitSegment(true)
        .build();
    const endLine =
      new CommandState(endLineCmd).mutate()
        .setSplitCommandId(endSplitCmd.getId())
        .build();

    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // TODO: write comment!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    const startLineCmd =
      newCommand('L', [startSplitPoint, endSplitPoint]).mutate()
        .setIsSubPathSplitSegment(true)
        .build();
    const startLine =
      new CommandState(startLineCmd).mutate()
        .setSplitCommandId(endSplitCmd.getId())
        .build();

    const startCommandStates: CommandState[] = [];
    for (let i = 0; i < css.length; i++) {
      if (i < start.csIdx || end.csIdx < i) {
        startCommandStates.push(css[i]);
      } else if (i === start.csIdx) {
        startCommandStates.push(firstLeft);
        startCommandStates.push(startLine);
      } else if (i === end.csIdx && secondRight) {
        startCommandStates.push(secondRight);
      }
    }

    const endCommandStates: CommandState[] = [];
    for (let i = 0; i < css.length; i++) {
      if (i === start.csIdx) {
        // The first move command shares an ID with the parent's first split location.
        const moveCmd = newCommand('M', [startSplitPoint, startSplitPoint]);
        endCommandStates.push(
          new CommandState(moveCmd).mutate()
            .setSplitCommandId(startSplitCmd.getId())
            .build());
        if (firstRight) {
          endCommandStates.push(firstRight);
        }
      } else if (start.csIdx < i && i < end.csIdx) {
        endCommandStates.push(css[i]);
      } else if (i === end.csIdx) {
        endCommandStates.push(secondLeft);
        endCommandStates.push(endLine);
      }
    }

    const splitBackingCommandIds = [css[start.csIdx].getId(), css[end.csIdx].getId()];
    const newStates: SubPathState[] = [];
    if (this.subPathStateMap.indexOf(sps) >= 0
      || splitBackingCommandIds.every(id => sps.getSplitBackingCommandIds().indexOf(id) < 0)) {
      console.info('add new level', splitBackingCommandIds, sps, sps.getSplitBackingCommandIds());
      const startSplitSubPath =
        new SubPathState(startCommandStates).mutate()
          .setSplitBackingCommandIds(splitBackingCommandIds)
          .build();
      const endSplitSubPath =
        new SubPathState(endCommandStates).mutate()
          .setSplitBackingCommandIds(splitBackingCommandIds)
          .build();
      newStates.push(
        sps.mutate()
          .setSplitSubPaths([startSplitSubPath, endSplitSubPath])
          .build());
    } else {
      const startSplitSubPath =
        new SubPathState(startCommandStates).mutate()
          .setSplitBackingCommandIds(splitBackingCommandIds)
          .build();
      const endSplitSubPath =
        new SubPathState(endCommandStates).mutate()
          .setSplitBackingCommandIds(splitBackingCommandIds)
          .build();
      newStates.push(startSplitSubPath);
      newStates.push(endSplitSubPath);
    }

    // Insert the new SubPathStates into the tree.
    this.subPathStateMap = (function replaceParentFn(states: SubPathState[]) {
      if (states.length === 0) {
        // Return undefined to signal that the parent was not found.
        return undefined;
      }
      for (let i = 0; i < states.length; i++) {
        const currentState = states[i];
        if (currentState === sps) {
          states.splice(i, 1, ...newStates);
          return states;
        }
        const recurseStates = replaceParentFn(currentState.getSplitSubPaths().slice());
        if (recurseStates) {
          states[i] =
            currentState.mutate()
              .setSplitSubPaths(recurseStates)
              .build();
          return states;
        }
      }
      // Return undefined to signal that the parent was not found.
      return undefined;
    })(this.subPathStateMap.slice());

    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Unsplits the stroked sub path at the specified index. The sub path's sibling
   * will be unsplit as well.
   */
  unsplitStrokedSubPath(subIdx: number) {
    const parent = findSubPathStateParent(this.subPathStateMap, this.subPathOrdering[subIdx]);
    const splitCmdId =
      _.last(_.last(parent.getSplitSubPaths()[0].getCommandStates()).getCommands()).getId();
    this.replaceParentAfterUnsplitSubPath(subIdx, [], [splitCmdId]);
    return this;
  }

  /**
   * Unsplits the stroked sub path at the specified index. The sub path's sibling
   * will be unsplit as well.
   */
  // TODO: deprecate this in favor of deleteSubPathSplitSegment() below?
  unsplitFilledSubPath(subIdx: number) {
    const parent = findSubPathStateParent(this.subPathStateMap, this.subPathOrdering[subIdx]);
    const firstSplitSubPath = parent.getSplitSubPaths()[0];
    const secondSplitSubPath = parent.getSplitSubPaths()[1];
    const flattenedSps = flattenSubPathStates(this.subPathStateMap);
    const firstSpsIdx = flattenedSps.indexOf(firstSplitSubPath);
    const secondSpsIdx = flattenedSps.indexOf(secondSplitSubPath);
    const firstSubIdx = this.toSubIdx(firstSpsIdx);
    const secondSubIdx = this.toSubIdx(secondSpsIdx);
    this.deleteSubPathSplitSegment(firstSubIdx, secondSubIdx);
    return this;
  }

  /**
   * Deletes the sub path split segment that created the specified two subpaths.
   */
  // TODO: deprecate this in favor of removeSubPathSplitSegment() below?
  deleteSubPathSplitSegment(firstSubIdx: number, secondSubIdx: number) {
    const firstSpsIdx = this.subPathOrdering[firstSubIdx];
    const secondSpsIdx = this.subPathOrdering[secondSubIdx];
    const firstSps = this.findSubPathState(firstSpsIdx);
    const secondSps = this.findSubPathState(secondSpsIdx);
    const parent = findSubPathStateParent(this.subPathStateMap, firstSpsIdx);
    let firstSpsParentIdx = parent.getSplitSubPaths().indexOf(firstSps);
    let secondSpsParentIdx = parent.getSplitSubPaths().indexOf(secondSps);
    if (firstSpsParentIdx > secondSpsParentIdx) {
      const temp = firstSpsParentIdx;
      firstSpsParentIdx = secondSpsParentIdx;
      secondSpsParentIdx = temp;
    }
    const secondSplitSubPath = parent.getSplitSubPaths()[secondSpsParentIdx];
    const firstSplitCmdId = secondSplitSubPath.getCommandStates()[0].getSplitCommandId();
    const secondSplitCmdId = _.last(secondSplitSubPath.getCommandStates()).getSplitCommandId();
    const splitCmdIds = [firstSplitCmdId, secondSplitCmdId];
    let updatedSplitSubPaths: SubPathState[] = [];
    if (parent.getSplitSubPaths().length > 2) {
      const splits = parent.getSplitSubPaths().slice();
      const firstSplitSps = splits[firstSpsParentIdx];
      const secondSplitSps = splits[firstSpsParentIdx + 1];
      const firstParentBackingCommand =
        _.find(parent.getCommandStates(),
          cs => firstSplitSps.getSplitBackingCommandIds()[0] === cs.getId());
      const secondParentBackingCommand =
        _.find(parent.getCommandStates(),
          cs => firstSplitSps.getSplitBackingCommandIds()[1] === cs.getId());
      const firstSplitCss = firstSplitSps.getCommandStates();
      const secondSplitCss = secondSplitSps.getCommandStates();

      const newCss: CommandState[] = [];
      let cs: CommandState;
      let i = 0;
      for (; i < firstSplitCss.length; i++) {
        cs = firstSplitCss[i];
        if (cs.getId() === firstParentBackingCommand.getId()) {
          break;
        }
        newCss.push(cs);
        console.info(newCss.slice());
      }
      const firstParentBackingCommandIdx = i;
      if (cs.getId() === secondSplitCss[1].getId()) {
        newCss.push(secondSplitCss[1].mergePrevious(cs));
        console.info(newCss.slice());
      } else {
        newCss.push(cs);
        console.info(newCss.slice());
        newCss.push(secondSplitCss[1]);
        console.info(newCss.slice());
      }
      for (i = 2; i < secondSplitCss.length; i++) {
        cs = secondSplitCss[i];
        if (cs.getId() === secondParentBackingCommand.getId()) {
          break;
        }
        newCss.push(cs);
        console.info(newCss.slice());
      }
      i = _.findIndex(firstSplitCss, c => c.getId() === secondParentBackingCommand.getId());
      if (i >= 0) {
        newCss.push(
          firstSplitCss[i].mergePrevious(cs).mutate()
            .setIsSubPathSplitSegment(secondParentBackingCommand.isSubPathSplitSegment())
            .build());
        console.info(newCss.slice());
      } else {
        console.info('firstSplitCss', firstSplitCss);
        console.info('newCss', newCss.slice());
        i = firstParentBackingCommandIdx + 1;
        // i = _.findLastIndex(
        //   firstSplitCss, c => c.getSplitCommandId() === _.last(secondSplitCss).getId());
        console.info(i);
        newCss.push(
          cs.mutate()
            .setIsSubPathSplitSegment(secondParentBackingCommand.isSubPathSplitSegment())
            .build());
      }
      for (i = i + 1; i < firstSplitCss.length; i++) {
        newCss.push(firstSplitCss[i]);
        console.info(newCss.slice());
      }
      splits.splice(firstSpsParentIdx, 2, new SubPathState(newCss.slice()));
      updatedSplitSubPaths = splits;
    }
    this.replaceParentAfterUnsplitSubPath(
      firstSubIdx, updatedSplitSubPaths, splitCmdIds);
    return this;
  }

  /**
   * Deletes the sub path split segment with the specified index.
   */
  removeSubPathSplitSegment(subIdx: number, cmdIdx: number) {
    console.info('before', this.subPathStateMap, this.subPathOrdering);
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findReversedAndShiftedInternalIndices(subIdx, cmdIdx);
    console.info(targetCs, spsIdx, csIdx, splitIdx);
    const results: Array<{ depth: number, index: number }> = [];
    (function recurseFn(sps: SubPathState, depth = 0, index = 0) {
      const hasId = sps.getCommandStates().some(cs => cs.getId() === targetCs.getId());
      if (hasId) {
        results.push({ depth, index });
      }
      //console.info(`sps at index ${index} and depth ${depth} result: ${hasId}`);
      for (let i = 0; i < sps.getSplitSubPaths().length; i++) {
        recurseFn(sps.getSplitSubPaths()[i], depth + 1, i);
      }
    })(this.subPathStateMap[0]);
    results.sort((obj1, obj2) => {
      if (obj1.depth === obj2.depth) {
        return obj1.index - obj2.index;
      }
      return obj1.depth - obj2.depth;
    });
    console.info(results.map(obj => obj.depth));
    console.info(results.map(obj => obj.index));
    const targetDepth = results[0].depth;
    const targetIndices = [results[0].index, results[1].index];
    let parent: SubPathState;
    (function recurseFn(sps: SubPathState, depth = 0, index = 0) {
      if (depth + 1 === targetDepth) {
        const children = sps.getSplitSubPaths();
        const hasId = children.length && children[targetIndices[0]].getCommandStates().some(cs => cs.getId() === targetCs.getId())
          && children[targetIndices[1]].getCommandStates().some(cs => cs.getId() === targetCs.getId());
        if (hasId) {
          parent = sps;
          return;
        }
      }
      for (let i = 0; i < sps.getSplitSubPaths().length; i++) {
        recurseFn(sps.getSplitSubPaths()[i], depth + 1, i);
      }
    })(this.subPathStateMap[0]);
    const secondSplitSubPath = parent.getSplitSubPaths()[targetIndices[1]];
    const firstSplitCmdId = secondSplitSubPath.getCommandStates()[0].getId();
    const secondSplitCmdId = _.last(secondSplitSubPath.getCommandStates()).getId();
    const splitCmdIds = [firstSplitCmdId, secondSplitCmdId];
    const flattenedSps = flattenSubPathStates(this.subPathStateMap);
    const deletedSps: SubPathState[] = [];
    let updatedSplitSubPaths: SubPathState[] = [];
    if (parent.getSplitSubPaths().length > 2) {
      const splits = parent.getSplitSubPaths().slice();
      deletedSps.push(splits[targetIndices[0] + 1]);
      splits.slice(targetIndices[0] + 1, 1);
      updatedSplitSubPaths = splits;
    } else {
      deletedSps.push(...parent.getSplitSubPaths());
    }
    const flattenedDeletedSps = flattenSubPathStates(deletedSps);
    console.info('flattenedDeletedSps', flattenedDeletedSps);
    flattenedDeletedSps.pop();
    const deletedSubIdxs =
      flattenedDeletedSps
        .map(sps => flattenedSps.indexOf(sps))
        .map(spsIdx => this.toSubIdx(spsIdx));
    console.info('deletedSubIdxs', deletedSubIdxs);
    const fn = () => {
      const mutator = parent.mutate().setSplitSubPaths(updatedSplitSubPaths);
      for (const id of splitCmdIds) {
        let csIdx = 0, splitIdx = -1;
        for (; csIdx < parent.getCommandStates().length; csIdx++) {
          const cs = parent.getCommandStates()[csIdx];
          const csIds = cs.getCommands().map((_, idx) => cs.getIdAtIndex(idx));
          splitIdx = csIds.indexOf(id);
          if (splitIdx >= 0) {
            break;
          }
        }
        if (parent.getCommandStates()[csIdx].isSplitAtIndex(splitIdx)) {
          // Delete the split point that created the sub path.
          const unsplitCs =
            parent.getCommandStates()[csIdx].mutate().unsplitAtIndex(splitIdx).build();
          mutator.setCommandState(unsplitCs, csIdx);
        }
      }
      this.subPathStateMap =
        replaceSubPathStateInternal(this.subPathStateMap, parent, mutator.build());
      console.info(deletedSubIdxs);
      deletedSubIdxs.sort((a, b) => b - a);
      for (const subIdx of deletedSubIdxs) {
        this.updateOrderingAfterUnsplitSubPath(subIdx);
      }
    };
    fn();
    console.info('after', this.subPathStateMap, this.subPathOrdering);
    return this;
  }

  private replaceParentAfterUnsplitSubPath(
    subIdx: number,
    updatedParentSplitSubPaths: SubPathState[],
    splitCmdIds: string[]) {

    console.info(
      'replaceParentAfterUnsplitSubPath', subIdx, updatedParentSplitSubPaths, splitCmdIds);
    const spsIdx = this.subPathOrdering[subIdx];
    const parent = findSubPathStateParent(this.subPathStateMap, spsIdx);
    const mutator = parent.mutate().setSplitSubPaths(updatedParentSplitSubPaths);
    for (const id of splitCmdIds) {
      let csIdx = 0, splitIdx = -1;
      for (; csIdx < parent.getCommandStates().length; csIdx++) {
        const cs = parent.getCommandStates()[csIdx];
        const csIds = cs.getCommands().map((_, idx) => cs.getIdAtIndex(idx));
        splitIdx = csIds.indexOf(id);
        if (splitIdx >= 0) {
          break;
        }
      }
      if (csIdx < parent.getCommandStates().length
        && parent.getCommandStates()[csIdx].isSplitAtIndex(splitIdx)) {
        // Delete the split point that created the sub path.
        const unsplitCs =
          parent.getCommandStates()[csIdx].mutate().unsplitAtIndex(splitIdx).build();
        mutator.setCommandState(unsplitCs, csIdx);
      }
    }
    this.subPathStateMap =
      replaceSubPathStateParent(this.subPathStateMap, spsIdx, mutator.build());
    this.updateOrderingAfterUnsplitSubPath(subIdx);
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
    const prevCmd =
      _.last(this.buildOrderedSubPathCommands()[this.subPathOrdering.length - 1]);
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
    const toSubIdxFn = (spsIdx: number) => {
      for (let subIdx = 0; subIdx < this.subPathOrdering.length; subIdx++) {
        if (this.subPathOrdering[subIdx] === spsIdx) {
          return subIdx;
        }
      }
      throw new Error('Invalid spsIdx: ' + spsIdx);
    };
    for (let spsIdx = 0; spsIdx < numSubPathsBeforeDelete; spsIdx++) {
      spsIdxToSubIdxMap.push(toSubIdxFn(spsIdx));
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
        _.flatten(this.buildOrderedSubPathCommands()),
        this.subPathStateMap,
        this.subPathOrdering,
        this.numCollapsingSubPaths,
      ));
  }

  private findSubPathState(spsIdx: number) {
    return findSubPathState(this.subPathStateMap, spsIdx);
  }

  private setSubPathState(state: SubPathState, spsIdx: number) {
    this.subPathStateMap = replaceSubPathStateLeaf(this.subPathStateMap, spsIdx, state);
  }

  private findReversedAndShiftedInternalIndices(subIdx: number, cmdIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const css = sps.getCommandStates();
    const numCommandsInSubPath = _.sum(css.map(cm => cm.getCommands().length));
    if (cmdIdx && sps.isReversed()) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.getShiftOffset();
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting (numCommandsInSubPath - 1) is intentional here
      // (as opposed to subtracting numCommandsInSubPath).
      cmdIdx -= numCommandsInSubPath - 1;
    }
    const { targetCs, csIdx, splitIdx } = this.findInternalIndices(css, cmdIdx);
    return { targetCs, spsIdx, csIdx, splitIdx };
  }

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

  private buildOrderedSubPathCommands() {
    const subPathCmds = flattenSubPathStates(this.subPathStateMap)
      .map(sps => _.flatMap(reverseAndShiftCommands(sps), cmds => cmds));
    const orderedSubPathCmds = this.subPathOrdering.map((_, subIdx) => {
      return subPathCmds[this.subPathOrdering[subIdx]];
    });
    return orderedSubPathCmds.map((subCmds, subIdx) => {
      const cmd = subCmds[0];
      if (subIdx === 0 && cmd.getStart()) {
        subCmds[0] = cmd.mutate().setPoints(undefined, cmd.getEnd()).build();
      } else if (subIdx !== 0) {
        const start = _.last(orderedSubPathCmds[subIdx - 1]).getEnd();
        subCmds[0] = cmd.mutate().setPoints(start, cmd.getEnd()).build();
      }
      return subCmds;
    });
  }

  private toSubIdx(spsIdx: number) {
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (this.subPathOrdering[i] === spsIdx) {
        return i;
      }
    }
    throw new Error('Invalid spsIdx: ' + spsIdx);
  };
}

function findSubPathStateParent(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  const subPathStateParents: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>, parent?: SubPathState) {
    currentLevel.forEach(state => {
      if (!state.getSplitSubPaths().length) {
        subPathStateParents.push(parent);
        return;
      }
      recurseFn(state.getSplitSubPaths(), state);
    });
  })(map);
  return subPathStateParents[spsIdx];
}

function replaceSubPathStateParent(
  map: ReadonlyArray<SubPathState>,
  spsIdx: number,
  replacement: SubPathState) {

  return replaceSubPathStateInternal(map, findSubPathStateParent(map, spsIdx), replacement);
}

function replaceSubPathStateLeaf(
  map: ReadonlyArray<SubPathState>,
  spsIdx: number,
  replacement: SubPathState) {

  return replaceSubPathStateInternal(map, findSubPathState(map, spsIdx), replacement);
}

function replaceSubPathStateInternal(
  map: ReadonlyArray<SubPathState>,
  target: SubPathState,
  replacement: SubPathState) {

  return (function replaceParentFn(states: SubPathState[]) {
    if (states.length === 0) {
      // Return undefined to signal that the parent was not found.
      return undefined;
    }
    for (let i = 0; i < states.length; i++) {
      const currentState = states[i];
      if (currentState === target) {
        states[i] = replacement;
        return states;
      }
      const recurseStates = replaceParentFn(currentState.getSplitSubPaths().slice());
      if (recurseStates) {
        states[i] =
          currentState.mutate()
            .setSplitSubPaths(recurseStates)
            .build();
        return states;
      }
    }
    // Return undefined to signal that the parent was not found.
    return undefined;
  })(map.slice());
}

function shiftAndReverseCommandStates(
  source: ReadonlyArray<CommandState>,
  isReversed: boolean,
  shiftOffset: number) {

  const css = source.slice();

  // If the last command is a 'Z', replace it with a line before we shift.
  // TODO: replacing the 'Z' messes up certain stroke-linejoin values
  css[css.length - 1] = _.last(css).mutate().forceConvertClosepathsToLines().build();

  return shiftCommandStates(reverseCommandStates(css, isReversed), isReversed, shiftOffset);
}

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

function shiftCommandStates(
  css: CommandState[],
  isReversed: boolean,
  shiftOffset: number) {

  if (!shiftOffset || css.length === 1) {
    return css;
  }

  const numCommands = _.sum(css.map(cs => cs.getCommands().length));
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

function reverseAndShiftCommands(subPathState: SubPathState) {
  return shiftCommands(subPathState, reverseCommands(subPathState));
}

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
    cmCmds[0] = cmCmds[0].mutate().toggleSplit().build();
    cmCmds[cmCmds.length - 1] =
      cmCmds[cmCmds.length - 1].mutate().toggleSplit().build();
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
