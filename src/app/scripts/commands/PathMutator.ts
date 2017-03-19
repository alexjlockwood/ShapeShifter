import { CommandState } from './CommandState';
import { PathState, findCommandMutation } from './PathState';
import * as _ from 'lodash';
import { Path, SubPath, SvgChar, Command } from '..';
import { PathImpl, createSubPaths } from '../PathImpl';
import { CommandImpl, newMove, newLine } from '../CommandImpl';
import { MathUtil, Matrix } from '../../common';
import * as PathUtil from './PathUtil';

/**
 * A builder class for creating new mutated Path objects.
 */
export class PathMutator {
  private readonly subPaths: ReadonlyArray<SubPath>;
  private readonly commandMutationsMap: CommandState[][];
  private readonly reversals: boolean[];
  private readonly shiftOffsets: number[];
  private readonly subPathOrdering: number[];

  constructor(ps: PathState) {
    this.subPaths = ps.subPaths;
    this.commandMutationsMap = ps.commandMutationsMap.map(cms => cms.slice());
    this.reversals = ps.reversals.slice();
    this.shiftOffsets = ps.shiftOffsets.slice();
    this.subPathOrdering = ps.subPathOrdering.slice();
  }

  private getMutationState() {
    return {
      commandMutationsMap: this.commandMutationsMap,
      reversals: this.reversals,
      shiftOffsets: this.shiftOffsets,
      subPathOrdering: this.subPathOrdering,
    };
  }

  /**
   * Reverses the order of the points in the sub path at the specified index.
   */
  reverseSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.reversals[this.subPathOrdering[subIdx]] = !this.reversals[cmsIdx];
    return this;
  }

  setShiftOffsetAt(subIdx: number, shiftOffset: number) {
    this.shiftOffsets[this.subPathOrdering[subIdx]] = shiftOffset;
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
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
    this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().splitAtIndex(splitIdx, ts).build();
    return this;
  }

  /**
   * Splits the command into two approximately equal parts.
   */
  splitCommandInHalf(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
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
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
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
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
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
   * Returns the initial starting state of this path.
   */
  revert() {
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
  build(): Path {
    const commandMutationsMap = this.commandMutationsMap;
    const reversals = this.reversals;
    const shiftOffsets = this.shiftOffsets;
    const subPathOrdering = this.subPathOrdering;

    const subPathCmds = commandMutationsMap.map((_, cmsIdx) => {
      return PathUtil.reverseAndShiftCommands(
        commandMutationsMap,
        reversals,
        shiftOffsets,
        cmsIdx,
      );
    });
    const reorderedSubPathCmds = [];
    for (let i = 0; i < subPathCmds.length; i++) {
      for (let j = 0; j < subPathOrdering.length; j++) {
        const reorderIdx = subPathOrdering[j];
        if (i === reorderIdx) {
          reorderedSubPathCmds.push(subPathCmds[j]);
          break;
        }
      }
    }
    const reorderedCommands = _.flatMap(reorderedSubPathCmds, cmds => cmds);
    reorderedCommands.forEach((cmd, i) => {
      if (cmd.svgChar === 'M') {
        if (i === 0 && cmd.start) {
          reorderedCommands[i] = newMove(undefined, cmd.end);
        } else if (i !== 0 && !cmd.start) {
          reorderedCommands[i] = newMove(reorderedCommands[i - 1].end, cmd.end);
        }
      }
    });
    return new PathImpl({
      commands: reorderedCommands,
      pathState: new PathState(createSubPaths(...reorderedCommands), {
        commandMutationsMap,
        reversals,
        shiftOffsets,
        subPathOrdering,
      }),
    });
  }
}
