import { CommandState } from './CommandState';
import { PathState, findCommandMutation } from './PathState';
import * as _ from 'lodash';
import { SubPath, SvgChar, Command } from '..';
import { PathImpl } from '../PathImpl';
import { CommandImpl, newMove, newLine } from '../CommandImpl';
import { MathUtil, Matrix } from '../../common';

export class PathMutator {
  private readonly commandMutationsMap: CommandState[][];
  private readonly reversals: boolean[];
  private readonly shiftOffsets: number[];
  private readonly subPathOrdering: number[];

  constructor(ps: PathState) {
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

  setReversedAt(subIdx: number, isReversed: boolean) {
    this.reversals[this.subPathOrdering[subIdx]] = isReversed;
    return this;
  }

  toggleReversedAt(subIdx: number) {
    const isReversed = this.reversals[this.subPathOrdering[subIdx]];
    this.reversals[this.subPathOrdering[subIdx]] = !isReversed;
    return this;
  }

  setShiftOffsetAt(subIdx: number, shiftOffset: number) {
    this.shiftOffsets[this.subPathOrdering[subIdx]] = shiftOffset;
    return this;
  }

  reverseSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.reversals[cmsIdx] = !this.reversals[cmsIdx];
    return this;
  }

  shiftSubPathBack(subIdx: number, numShifts: number) {
    return this.reversals[this.subPathOrdering[subIdx]]
      ? this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1))
      : this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1));
  }

  shiftSubPathForward(subIdx: number, numShifts: number) {
    return this.reversals[this.subPathOrdering[subIdx]]
      ? this.shift(subIdx, (o, n) => (o + numShifts) % (n - 1))
      : this.shift(subIdx, (o, n) => MathUtil.floorMod(o - numShifts, n - 1));
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

  splitCommand(subIdx: number, cmdIdx: number, ...ts: number[]) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
    this.maybeUpdateShiftOffsetsAfterSplit(cmsIdx, cmIdx, ts.length);
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().splitAtIndex(splitIdx, ts).build();
    return this;
  }

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

  unsplitCommand(subIdx: number, cmdIdx: number) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
    const isSubPathReversed = this.reversals[cmsIdx];
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().unsplitAtIndex(isSubPathReversed ? splitIdx - 1 : splitIdx).build();
    const shiftOffset = this.shiftOffsets[cmsIdx];
    let shiftOffsets = undefined;
    if (shiftOffset && cmIdx <= shiftOffset) {
      // Subtract the shift offset by 1 to ensure that the unsplit operation
      // doesn't alter the positions of the path points.
      shiftOffsets = this.shiftOffsets.slice();
      shiftOffsets[cmsIdx] = shiftOffset - 1;
    }
    return this;
  }

  convertCommand(subIdx: number, cmdIdx: number, svgChar: SvgChar) {
    const { targetCm, cmsIdx, cmIdx, splitIdx } =
      findCommandMutation(subIdx, cmdIdx, this.getMutationState());
    this.commandMutationsMap[cmsIdx][cmIdx] =
      targetCm.mutate().convertAtIndex(splitIdx, svgChar).build();
    return this;
  }

  unconvertSubPath(subIdx: number) {
    const cmsIdx = this.subPathOrdering[subIdx];
    this.commandMutationsMap[cmsIdx] =
      this.commandMutationsMap[cmsIdx].map((cm, i) =>
        i === 0 ? cm : cm.mutate().unconvertSubpath().build());
    return this;
  }

  transformPath(transforms: Matrix[]) {
    this.commandMutationsMap.forEach((cms, i) => {
      cms.forEach((cm, j) => {
        this.commandMutationsMap[i][j] = cm.mutate().transform(transforms).build();
      });
    });
    return this;
  }

  moveSubPath(fromSubIdx: number, toSubIdx: number) {
    this.subPathOrdering.splice(toSubIdx, 0, this.subPathOrdering.splice(fromSubIdx, 1)[0]);
    return this;
  }

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

  build() {
    const commandMutationsMap = this.commandMutationsMap;
    const reversals = this.reversals;
    const shiftOffsets = this.shiftOffsets;
    const subPathOrdering = this.subPathOrdering;

    const maybeReverseCommandsFn = (cmsIdx: number) => {
      const subPathCms = commandMutationsMap[cmsIdx];
      const hasOneCmd =
        subPathCms.length === 1 && subPathCms[0].getCommands().length === 1;
      if (hasOneCmd || !reversals[cmsIdx]) {
        // Nothing to do in these two cases.
        return _.flatMap(subPathCms, cm => cm.getCommands() as CommandImpl[]);
      }

      // Extract the commands from our command mutation map.
      const cmds = _.flatMap(subPathCms, cm => {
        // Consider a segment A ---- B ---- C with AB split and
        // BC non-split. When reversed, we want the user to see
        // C ---- B ---- A w/ CB split and BA non-split.
        const cmCmds = cm.getCommands().slice();
        if (cmCmds[0].svgChar === 'M') {
          return cmCmds;
        }
        cmCmds[0] = cmCmds[0].toggleSplit();
        cmCmds[cmCmds.length - 1] = cmCmds[cmCmds.length - 1].toggleSplit();
        return cmCmds;
      });

      // If the last command is a 'Z', replace it with a line before we reverse.
      const lastCmd = _.last(cmds);
      if (lastCmd.svgChar === 'Z') {
        const lineCmd = newLine(lastCmd.start, lastCmd.end);
        cmds[cmds.length - 1] = lastCmd.isSplit ? lineCmd.toggleSplit() : lineCmd;
      }

      // Reverse the commands.
      const newCmds = [];
      for (let i = cmds.length - 1; i > 0; i--) {
        newCmds.push(cmds[i].reverse());
      }
      newCmds.unshift(newMove(cmds[0].start, newCmds[0].start));
      return newCmds;
    };

    const maybeShiftCommandsFn = (cmsIdx: number, cmds: Command[]) => {
      let shiftOffset = shiftOffsets[cmsIdx];
      if (!shiftOffset
        || cmds.length === 1
        || !_.first(cmds).end.equals(_.last(cmds).end)) {
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
      if (lastCmd.svgChar === 'Z') {
        // TODO: replacing the 'Z' messes up certain stroke-linejoin values
        const lineCmd = newLine(lastCmd.start, lastCmd.end);
        cmds[numCommands - 1] = lastCmd.isSplit ? lineCmd.toggleSplit() : lineCmd;
      }

      const newCmds: Command[] = [];

      // Handle these case separately cause they are annoying and I'm sick of edge cases.
      if (shiftOffset === 1) {
        newCmds.push(newMove(cmds[0].start, cmds[1].end));
        for (let i = 2; i < cmds.length; i++) {
          newCmds.push(cmds[i]);
        }
        newCmds.push(cmds[1]);
        return newCmds;
      } else if (shiftOffset === numCommands - 1) {
        newCmds.push(newMove(cmds[0].start, cmds[numCommands - 2].end));
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
      newCmds.unshift(newMove(prevMoveCmd.start, _.last(newCmds).end));
      return newCmds;
    };

    const subPathCmds = commandMutationsMap.map((_, cmsIdx) => {
      return maybeShiftCommandsFn(cmsIdx, maybeReverseCommandsFn(cmsIdx));
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
      pathState: new PathState({
        commandMutationsMap,
        reversals,
        shiftOffsets,
        subPathOrdering,
      }),
    });
  }
}
