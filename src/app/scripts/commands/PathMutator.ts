import * as _ from 'lodash';
import { SvgChar, Command } from '.';
import { newCommand } from './CommandImpl';
import { PathImpl } from './PathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';
import {
  SubPathState,
  findSubPathState,
  flattenSubPathStates,
} from './SubPathState';

/**
 * A builder class for creating new mutated Path objects.
 */
export class PathMutator {
  // Maps spsIdx --> SubPathState leaf object.
  private subPathStateMap: SubPathState[];
  // Maps subIdx --> spsIdx.
  private subPathOrdering: number[];
  private numCollapsingSubPaths: number;

  constructor(ps: PathState) {
    this.subPathStateMap = ps.subPathStateMap.slice();
    this.subPathOrdering = ps.subPathOrdering.slice();
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  private findSubPathState(spsIdx: number) {
    return findSubPathState(this.subPathStateMap, spsIdx);
  }

  private setSubPathState(state: SubPathState, spsIdx: number) {
    this.subPathStateMap = replaceSubPathStateLeaf(this.subPathStateMap, spsIdx, state);
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
    return this.findSubPathState(spsIdx).isReversed
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    const spsIdx = this.subPathOrdering[subIdx];
    return this.findSubPathState(spsIdx).isReversed
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const numCommandsInSubPath =
      _.sum(sps.commandStates.map(cm => cm.getCommands().length));
    if (numCommandsInSubPath <= 1) {
      // TODO: also return here if the sub path is closed just to be safe?
      return this;
    }
    this.setSubPathState(
      sps.mutate()
        .setShiftOffset(calcOffsetFn(sps.shiftOffset, numCommandsInSubPath))
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
      this.findCommandStateInfo(subIdx, cmdIdx);
    const shiftOffset =
      this.getUpdatedShiftOffsetsAfterSplit(spsIdx, csIdx, ts.length);
    const sps = this.findSubPathState(spsIdx);
    if (sps.isReversed) {
      // TODO: use minT/maxT?
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
      this.findCommandStateInfo(subIdx, cmdIdx);
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
    if (sps.shiftOffset && csIdx <= sps.shiftOffset) {
      return sps.shiftOffset + numSplits;
    }
    return sps.shiftOffset;
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCs, spsIdx, csIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    const isSubPathReversed = this.findSubPathState(spsIdx).isReversed;
    this.setSubPathState(
      this.findSubPathState(spsIdx).mutate()
        .setCommandState(targetCs.mutate()
          .unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx)
          .build(), csIdx)
        .build(),
      spsIdx);
    const shiftOffset = this.findSubPathState(spsIdx).shiftOffset;
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
      this.findCommandStateInfo(subIdx, cmdIdx);
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
      sps.commandStates.map((cs, csIdx) => {
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
          .setCommandStates(sps.commandStates.map(cs => applyFn(cs)))
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
    const css = shiftAndReverseCommandStates(sps.commandStates, sps.isReversed, sps.shiftOffset);
    const { csIdx, splitIdx } = this.findCommandStateIndices(css, cmdIdx);
    const startCommandStates: CommandState[] = [];
    const endCommandStates: CommandState[] = [];
    for (let i = 0; i < css.length; i++) {
      if (i < csIdx) {
        startCommandStates.push(css[i]);
      } else if (csIdx < i) {
        endCommandStates.push(css[i]);
      } else {
        const splitPoint = css[i].getCommands()[splitIdx].getEnd();
        const { left, right } = css[i].fork(splitIdx);
        startCommandStates.push(left);
        let endMoveCs = new CommandState(newCommand('M', [splitPoint, splitPoint]));
        if (sps.isReversed) {
          endMoveCs = endMoveCs.mutate().reverse().build();
        }
        endCommandStates.push(endMoveCs);
        if (right) {
          endCommandStates.push(right);
        }
      }
    }
    const splitSubPaths: SubPathState[] = [
      // TODO: should/could one of these sub paths share the same ID as the parent?
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    this.setSubPathState(sps.mutate().setSplitSubPaths(splitSubPaths).build(), spsIdx);
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Unsplits the stroked sub path at the specified index. The sub path's sibling
   * will be unsplit as well.
   */
  unsplitStrokedSubPath(subIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const parent = findSubPathStateParent(this.subPathStateMap, spsIdx);
    const firstSplitSubPath = parent.splitSubPaths[0];
    const splitCmdId =
      _.last(_.last(firstSplitSubPath.commandStates).getCommands()).getId();
    let csIdx = -1;
    let splitIdx = -1;
    for (csIdx = 0; csIdx < parent.commandStates.length; csIdx++) {
      const cs = parent.commandStates[csIdx];
      const csIds = cs.getCommands().map((_, idx) => cs.getIdAtIndex(idx));
      splitIdx = csIds.indexOf(splitCmdId);
      if (splitIdx >= 0) {
        break;
      }
    }
    const parentMutator = parent.mutate().setSplitSubPaths([]);
    if (parent.commandStates[csIdx].isSplitAtIndex(splitIdx)) {
      const unsplitCs = parent.commandStates[csIdx].mutate().unsplitAtIndex(splitIdx).build();
      parentMutator.setCommandState(unsplitCs, csIdx);
    }
    const updatedParentNode = parentMutator.build();
    this.subPathStateMap = replaceSubPathStateParent(this.subPathStateMap, spsIdx, updatedParentNode);
    this.subPathOrdering.splice(subIdx, 1);
    for (let i = 0; i < this.subPathOrdering.length; i++) {
      if (spsIdx < this.subPathOrdering[i]) {
        this.subPathOrdering[i]--;
      }
    }
    return this;
  }

  /**
   * Splits a filled sub path using the specified indices.
   */
  splitFilledSubPath(subIdx: number, startCmdIdx: number, endCmdIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const css = shiftAndReverseCommandStates(sps.commandStates, sps.isReversed, sps.shiftOffset);
    let start = this.findCommandStateIndices(css, startCmdIdx);
    let end = this.findCommandStateIndices(css, endCmdIdx);
    if (start.csIdx > end.csIdx
      || (start.csIdx === end.csIdx && start.splitIdx > end.csIdx)) {
      const temp = start;
      start = end;
      end = temp;
    }

    // firstLeft is the left portion of the first split segment (to use in the first split path).
    // secondLeft is the left portion of the second split segment (to use in the second split path).
    // firstRight is the right portion of the first split segment (to use in the second split path).
    // secondRight is the right portion of the second split segment (to use in the first split path).
    const { left: firstLeft, right: firstRight } = css[start.csIdx].fork(start.splitIdx);
    const { left: secondLeft, right: secondRight } = css[end.csIdx].fork(end.splitIdx);
    const startSplitPoint = firstLeft.getCommands()[start.splitIdx].getEnd();
    const endSplitPoint = secondLeft.getCommands()[end.splitIdx].getEnd();
    const startLine = new CommandState(newCommand('L', [startSplitPoint, endSplitPoint]));
    const endLine = new CommandState(newCommand('L', [endSplitPoint, startSplitPoint]));

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
        endCommandStates.push(new CommandState(newCommand('M', [startSplitPoint, startSplitPoint])));
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

    const splitSubPaths: SubPathState[] = [
      // TODO: should/could one of these sub paths share the same ID as the parent?
      new SubPathState(startCommandStates),
      new SubPathState(endCommandStates),
    ];
    this.setSubPathState(sps.mutate().setSplitSubPaths(splitSubPaths).build(), spsIdx);
    this.subPathOrdering.push(this.subPathOrdering.length);
    return this;
  }

  /**
   * Unsplits the stroked sub path at the specified index. The sub path's sibling
   * will be unsplit as well.
   */
  unsplitFilledSubPath(subIdx: number) {

    // TODO: implement this
    return this;
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
    return new PathImpl(
      new PathState(
        _.flatMap(this.buildOrderedSubPathCommands(), cmds => cmds),
        this.subPathStateMap,
        this.subPathOrdering,
        this.numCollapsingSubPaths,
      ));
  }

  private findCommandStateInfo(subIdx: number, cmdIdx: number) {
    const spsIdx = this.subPathOrdering[subIdx];
    const sps = this.findSubPathState(spsIdx);
    const subPathCss = sps.commandStates;
    const numCommandsInSubPath = _.sum(subPathCss.map(cm => cm.getCommands().length));
    if (cmdIdx && sps.isReversed) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += sps.shiftOffset;
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting (numCommandsInSubPath - 1) is intentional here
      // (as opposed to subtracting numCommandsInSubPath).
      cmdIdx -= numCommandsInSubPath - 1;
    }
    let counter = 0;
    let csIdx = 0;
    for (const targetCs of subPathCss) {
      if (counter + targetCs.getCommands().length > cmdIdx) {
        return { targetCs, spsIdx, csIdx, splitIdx: cmdIdx - counter };
      }
      counter += targetCs.getCommands().length;
      csIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }

  private findCommandStateIndices(css: ReadonlyArray<CommandState>, cmdIdx: number) {
    let counter = 0;
    let csIdx = 0;
    for (const targetCs of css) {
      if (counter + targetCs.getCommands().length > cmdIdx) {
        return { csIdx, splitIdx: cmdIdx - counter };
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
}

function findSubPathStateParent(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  const subPathStateParents: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>, parent?: SubPathState) {
    currentLevel.forEach(state => {
      if (!state.splitSubPaths.length) {
        subPathStateParents.push(parent);
        return;
      }
      recurseFn(state.splitSubPaths, state);
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
      const recurseStates = replaceParentFn(currentState.splitSubPaths.slice());
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

  // TODO: test closepaths
  // TODO: test closepaths
  // TODO: test closepaths
  // TODO: test closepaths
  // TODO: test closepaths
  // TODO: test closepaths
  // TODO: test closepaths

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
  const { left, right } = targetCs.fork(targetSplitIdx);
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
  const subPathCss = subPathState.commandStates;
  const hasOneCmd =
    subPathCss.length === 1 && subPathCss[0].getCommands().length === 1;
  if (hasOneCmd || !subPathState.isReversed) {
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
  let shiftOffset = subPathState.shiftOffset;
  if (!shiftOffset
    || cmds.length === 1
    || !_.first(cmds).getEnd().equals(_.last(cmds).getEnd())) {
    // If there is no shift offset, the sub path is one command long,
    // or if the sub path is not closed, then do nothing.
    return cmds;
  }

  const numCommands = cmds.length;
  if (subPathState.isReversed) {
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
