import * as _ from 'lodash';
import { SvgChar, Command } from '.';
import { newCommand } from './CommandImpl';
import { PathImpl } from './PathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix, Point } from '../common';
import { PathState } from './PathState';

/**
 * A builder class for creating new mutated Path objects.
 */
export class PathMutator {
  private readonly commandMutationsMap: CommandState[][];
  private readonly reversals: boolean[];
  private readonly shiftOffsets: number[];
  private readonly subPathIds: string[];
  private readonly subPathOrdering: number[];
  private numCollapsingSubPaths: number;

  constructor(ps: PathState) {
    this.commandMutationsMap = ps.commandMutationsMap.map(cms => cms.slice());
    this.reversals = ps.reversals.slice();
    this.shiftOffsets = ps.shiftOffsets.slice();
    this.subPathIds = ps.subPathIds.slice();
    this.subPathOrdering = ps.subPathOrdering.slice();
    this.numCollapsingSubPaths = ps.numCollapsingSubPaths;
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.reversals[this.subPathOrdering[subIdx]] = !this.reversals[cmsIdx];
    return this;
  }

  /**
   * Shifts back the order of the points in the sub path at the specified index.
   */
  shiftSubPathBack(subIdx: number, numShifts = 1) {
    return this.reversals[this.subPathOrdering[subIdx]]
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
  }

  /**
   * Shifts forward the order of the points in the sub path at the specified index.
   */
  shiftSubPathForward(subIdx: number, numShifts = 1) {
    return this.reversals[this.subPathOrdering[subIdx]]
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  private shift(subIdx: number, calcOffsetFn: (offset: number, numCommands: number) => number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const subPathCms = this.commandMutationsMap[cmsIdx];
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
    if (numCommandsInSubPath <= 1) {
      // TODO: also return here if the sub path is closed just to be safe?
      return this;
    }
    this.shiftOffsets[cmsIdx] =
      calcOffsetFn(this.shiftOffsets[cmsIdx], numCommandsInSubPath);
    return this;
  }

  /**
   * Splits the command using the specified t values.
   */
  splitCommand(subIdx: number, cmdIdx: number, ...ts: number[]) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      this.findCommandStateInfo(subIdx, cmdIdx);
    this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().splitAtIndex(splitIdx, ts).build();
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, 1);
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().splitInHalfAtIndex(splitIdx).build();
    return this;
  }

  // If 0 <= cmIdx <= shiftOffset, then that means we need to increase the
  // shift offset to account for the new split points that are about to be inserted.
  // Note that this method assumes all splits will occur within the same cmdIdx
  // command. This means that the shift offset will only ever increase by either
  // 'numShifts' or '0', since it will be impossible for splits to be added on
  // both sides of the shift pivot. We could fix that, but it's a lot of
  // complicated indexing and I don't think the user will ever need to do this anyway.
  private maybeUpdateShiftOffsetsAfterSplit(cmsIdx: number, cmIdx: number, numSplits: number) {
    const shiftOffset = this.shiftOffsets[cmsIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      this.shiftOffsets[cmsIdx] = shiftOffset + numSplits;
    }
  }

  /**
   * Un-splits the path at the specified index. Returns a new path object.
   */
  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    const isSubPathReversed = this.reversals[cmsIdx];
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx).build();
    const shiftOffset = this.shiftOffsets[cmsIdx];
    if (shiftOffset && cmIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      this.shiftOffsets[cmsIdx] = shiftOffset - 1;
    }
    return this;
  }

  /**
   * Convert the path at the specified index. Returns a new path object.
   */
  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } = this.findCommandStateInfo(subIdx, cmdIdx);
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().convertAtIndex(splitIdx, svgChar).build();
    return this;
  }

  /**
   * Reverts any conversions previously performed in the specified sub path.
   */
  unconvertSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.commandMutationsMap[cmsIdx] =
      this.commandMutationsMap[cmsIdx].map((cm, i) =>
        i === 0 ? cm : cm.mutate().unconvertSubpath().build());
    return this;
  }

  /**
   * Adds transforms on the path using the specified transformation matrices.
   */
  addTransforms(transforms: Matrix[]) {
    this.commandMutationsMap.forEach((cms, i) => {
      cms.forEach((cm, j) => {
        this.commandMutationsMap[i][j] = cm.mutate().addTransforms(transforms).build();
      });
    });
    return this;
  }

  /**
   * Sets transforms on the path using the specified transformation matrices.
   */
  setTransforms(transforms: Matrix[]) {
    this.commandMutationsMap.forEach((cms, i) => {
      cms.forEach((cm, j) => {
        this.commandMutationsMap[i][j] = cm.mutate().setTransforms(transforms).build();
      });
    });
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
   * Adds a collapsing subpath to the path.
   */
  addCollapsingSubPath(point: Point, numCommands: number) {
    const numSubPathsBeforeAdd = this.commandMutationsMap.length;
    const prevCmd =
      _.last(
        reverseAndShiftCommands(
          this.commandMutationsMap,
          this.reversals,
          this.shiftOffsets,
          numSubPathsBeforeAdd - 1));
    const cms: CommandState[] =
      [new CommandState(newCommand('M', [prevCmd.getEnd(), point]))];
    for (let i = 1; i < numCommands; i++) {
      cms.push(new CommandState(newCommand('L', [point, point])));
    }
    this.commandMutationsMap.push(cms);
    this.reversals.push(false);
    this.shiftOffsets.push(0);
    this.subPathOrdering.push(numSubPathsBeforeAdd);
    this.subPathIds.push(_.uniqueId());
    this.numCollapsingSubPaths++;
    return this;
  }

  /**
   * Deletes all collapsing subpaths from the path.
   */
  deleteCollapsingSubPaths() {
    const numSubPathsBeforeDelete = this.commandMutationsMap.length;
    const cmsIdxToSubIdxMap: number[] = [];
    const toSubIdxFn = (cmsIdx: number) => {
      for (let subIdx = 0; subIdx < this.subPathOrdering.length; subIdx++) {
        if (this.subPathOrdering[subIdx] === cmsIdx) {
          return subIdx;
        }
      }
      throw new Error('Invalid cmsIdx: ' + cmsIdx);
    };
    for (let cmsIdx = 0; cmsIdx < numSubPathsBeforeDelete; cmsIdx++) {
      cmsIdxToSubIdxMap.push(toSubIdxFn(cmsIdx));
    }
    const numCollapsingSubPathsBeforeDelete = this.numCollapsingSubPaths;
    const numSubPathsAfterDelete =
      numSubPathsBeforeDelete - numCollapsingSubPathsBeforeDelete;
    function deleteCollapsingSubPathInfoFn<T>(arr: T[]) {
      arr.splice(numSubPathsAfterDelete, numCollapsingSubPathsBeforeDelete);
    }
    deleteCollapsingSubPathInfoFn(this.commandMutationsMap);
    deleteCollapsingSubPathInfoFn(this.reversals);
    deleteCollapsingSubPathInfoFn(this.shiftOffsets);
    deleteCollapsingSubPathInfoFn(this.subPathIds);
    deleteCollapsingSubPathInfoFn(cmsIdxToSubIdxMap);
    this.subPathOrdering.splice(0, this.subPathOrdering.length);
    for (let subIdx = 0; subIdx < numSubPathsBeforeDelete; subIdx++) {
      for (let i = 0; i < cmsIdxToSubIdxMap.length; i++) {
        if (cmsIdxToSubIdxMap[i] === subIdx) {
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
    this.commandMutationsMap.forEach((cms, i) => {
      cms.forEach((cm, j) => {
        this.commandMutationsMap[i][j] = cm.mutate().revert().build();
      });
    });
    this.reversals.forEach((_, i) => this.reversals[i] = false);
    this.shiftOffsets.forEach((_, i) => this.shiftOffsets[i] = 0);
    this.subPathOrdering.forEach((_, i) => this.subPathOrdering[i] = i);
    return this;
  }

  /**
   * Builds a new mutated path.
   */
  build() {
    const commandMutationsMap = this.commandMutationsMap;
    const reversals = this.reversals;
    const shiftOffsets = this.shiftOffsets;
    const subPathIds = this.subPathIds;
    const subPathOrdering = this.subPathOrdering;
    const numCollapsingSubPaths = this.numCollapsingSubPaths;

    const subPathCmds = commandMutationsMap.map((_, cmsIdx) => {
      return reverseAndShiftCommands(
        commandMutationsMap,
        reversals,
        shiftOffsets,
        cmsIdx,
      );
    });
    const reorderedSubPathCmds: Command[][] = [];
    for (let i = 0; i < subPathOrdering.length; i++) {
      reorderedSubPathCmds.push(subPathCmds[subPathOrdering[i]]);
    }
    const reorderedCommands: Command[] =
      _.flatMap(reorderedSubPathCmds, cmds => cmds);
    reorderedCommands.forEach((cmd, i) => {
      if (i === 0) {
        if (cmd.getStart()) {
          reorderedCommands[i] =
            cmd.mutate().setPoints(undefined, cmd.getEnd()).build();
        }
      } else {
        const pts = cmd.getPoints().slice();
        pts[0] = reorderedCommands[i - 1].getEnd();
        reorderedCommands[i] = cmd.mutate().setPoints(...pts).build();
      }
    });
    return new PathImpl(
      new PathState(
        reorderedCommands,
        commandMutationsMap,
        reversals,
        shiftOffsets,
        subPathIds,
        subPathOrdering,
        numCollapsingSubPaths,
      ));
  }

  private findCommandStateInfo(subIdx: number, cmdIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    const subPathCms = this.commandMutationsMap[cmsIdx];
    const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
    if (cmdIdx && this.reversals[cmsIdx]) {
      cmdIdx = numCommandsInSubPath - cmdIdx;
    }
    cmdIdx += this.shiftOffsets[cmsIdx];
    if (cmdIdx >= numCommandsInSubPath) {
      // Note that subtracting (numCommandsInSubPath - 1) is intentional here
      // (as opposed to subtracting numCommandsInSubPath).
      cmdIdx -= numCommandsInSubPath - 1;
    }
    let counter = 0;
    let cmIdx = 0;
    for (const targetCm of subPathCms) {
      if (counter + targetCm.getCommands().length > cmdIdx) {
        return { targetCm, cmsIdx, cmIdx, splitIdx: cmdIdx - counter };
      }
      counter += targetCm.getCommands().length;
      cmIdx++;
    }
    throw new Error('Error retrieving command mutation');
  }
}

function reverseAndShiftCommands(
  commandMutationsMap: ReadonlyArray<ReadonlyArray<CommandState>>,
  reversals: ReadonlyArray<boolean>,
  shiftOffsets: ReadonlyArray<number>,
  cmsIdx: number) {

  const reversedCmds = reverseCommands(commandMutationsMap, reversals, cmsIdx);
  return shiftCommands(reversedCmds, reversals, shiftOffsets, cmsIdx);
}

function reverseCommands(
  commandMutationsMap: ReadonlyArray<ReadonlyArray<CommandState>>,
  reversals: ReadonlyArray<boolean>,
  cmsIdx: number) {

  const subPathCms = commandMutationsMap[cmsIdx];
  const hasOneCmd =
    subPathCms.length === 1 && subPathCms[0].getCommands().length === 1;
  if (hasOneCmd || !reversals[cmsIdx]) {
    // Nothing to do in these two cases.
    return _.flatMap(subPathCms, cm => cm.getCommands() as Command[]);
  }

  // Extract the commands from our command mutation map.
  const cmds = _.flatMap(subPathCms, cm => {
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
};

function shiftCommands(
  cmds: Command[],
  reversals: ReadonlyArray<boolean>,
  shiftOffsets: ReadonlyArray<number>,
  cmsIdx: number) {

  let shiftOffset = shiftOffsets[cmsIdx];
  if (!shiftOffset
    || cmds.length === 1
    || !_.first(cmds).getEnd().equals(_.last(cmds).getEnd())) {
    // If there is no shift offset, the sub path is one command long,
    // or if the sub path is not closed, then do nothing.
    return cmds;
  }

  const numCommands = cmds.length;
  if (reversals[cmsIdx]) {
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
};
