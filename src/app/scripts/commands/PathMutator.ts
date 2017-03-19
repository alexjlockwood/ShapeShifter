import * as _ from 'lodash';
import { SvgChar, SubPath, Command, CommandBuilder } from '.';
import { PathImpl } from './PathImpl';
import { CommandState } from './CommandState';
import { MathUtil, Matrix } from '../common';
import { PathState } from './PathState';

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
  build() {
    const commandMutationsMap = this.commandMutationsMap;
    const reversals = this.reversals;
    const shiftOffsets = this.shiftOffsets;
    const subPathOrdering = this.subPathOrdering;

    const subPathCmds = commandMutationsMap.map((_, cmsIdx) => {
      return reverseAndShiftCommands(
        commandMutationsMap,
        reversals,
        shiftOffsets,
        cmsIdx,
      );
    });
    const reorderedSubPathCmds: Command[][] = [];
    for (let i = 0; i < subPathCmds.length; i++) {
      for (let j = 0; j < subPathOrdering.length; j++) {
        const reorderIdx = subPathOrdering[j];
        if (i === reorderIdx) {
          reorderedSubPathCmds.push(subPathCmds[j]);
          break;
        }
      }
    }
    const reorderedCommands: Command[] =
      _.flatMap(reorderedSubPathCmds, cmds => cmds);
    reorderedCommands.forEach((cmd, i) => {
      if (cmd.svgChar === 'M') {
        if (i === 0 && cmd.start) {
          reorderedCommands[i] =
            new CommandBuilder('M', [undefined, cmd.end]).build();
        } else if (i !== 0 && !cmd.start) {
          reorderedCommands[i] =
            new CommandBuilder('M', [reorderedCommands[i - 1].end, cmd.end]).build();
        }
      }
    });
    return new PathImpl(
      new PathState(
        reorderedCommands,
        commandMutationsMap,
        reversals,
        shiftOffsets,
        subPathOrdering,
      ));
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
    if (cmCmds[0].svgChar === 'M') {
      return cmCmds;
    }
    cmCmds[0] = cmCmds[0].mutate().toggleSplit().build();
    cmCmds[cmCmds.length - 1] =
      cmCmds[cmCmds.length - 1].mutate().toggleSplit().build();
    return cmCmds;
  });

  // If the last command is a 'Z', replace it with a line before we reverse.
  const lastCmd = _.last(cmds);
  if (lastCmd.svgChar === 'Z') {
    const lineCmd =
      new CommandBuilder('L', [lastCmd.start, lastCmd.end]).build();
    cmds[cmds.length - 1] =
      lastCmd.isSplit ? lineCmd.mutate().toggleSplit().build() : lineCmd;
  }

  // Reverse the commands.
  const newCmds: Command[] = [];
  for (let i = cmds.length - 1; i > 0; i--) {
    newCmds.push(cmds[i].mutate().reverse().build());
  }
  newCmds.unshift(new CommandBuilder('M', [cmds[0].start, newCmds[0].start]).build());
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
    const lineCmd = new CommandBuilder('L', [lastCmd.start, lastCmd.end]).build();
    cmds[numCommands - 1] =
      lastCmd.isSplit ? lineCmd.mutate().toggleSplit().build() : lineCmd;
  }

  const newCmds: Command[] = [];

  // Handle these case separately cause they are annoying and I'm sick of edge cases.
  if (shiftOffset === 1) {
    newCmds.push(new CommandBuilder('M', [cmds[0].start, cmds[1].end]).build());
    for (let i = 2; i < cmds.length; i++) {
      newCmds.push(cmds[i]);
    }
    newCmds.push(cmds[1]);
    return newCmds;
  } else if (shiftOffset === numCommands - 1) {
    newCmds.push(
      new CommandBuilder('M', [cmds[0].start, cmds[numCommands - 2].end]).build());
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
    new CommandBuilder('M', [prevMoveCmd.start, _.last(newCmds).end]).build());
  return newCmds;
};

/**
 * Finds and returns the command mutation at the specified indices.
 * @param subIdx the client-visible subpath index
 * @param cmdIdx the client-visible command index
 */
export function findCommandMutation(subIdx: number, cmdIdx: number, ms: MutationState) {
  const cmsIdx = ms.subPathOrdering[subIdx];
  const subPathCms = ms.commandMutationsMap[cmsIdx];
  const numCommandsInSubPath = _.sum(subPathCms.map(cm => cm.getCommands().length));
  if (cmdIdx && ms.reversals[cmsIdx]) {
    cmdIdx = numCommandsInSubPath - cmdIdx;
  }
  cmdIdx += ms.shiftOffsets[cmsIdx];
  if (cmdIdx >= numCommandsInSubPath) {
    cmdIdx -= (numCommandsInSubPath - 1);
  }
  let counter = 0;
  let cmIdx = 0;
  for (const targetCm of subPathCms) {
    if (counter + targetCm.getCommands().length > cmdIdx) {
      const splitIdx = cmdIdx - counter;
      return { targetCm, cmsIdx, cmIdx, splitIdx };
    }
    counter += targetCm.getCommands().length;
    cmIdx++;
  }
  throw new Error('Error retrieving command mutation');
}

interface MutationState {
  readonly commandMutationsMap?: ReadonlyArray<ReadonlyArray<CommandState>>;
  readonly reversals?: ReadonlyArray<boolean>;
  readonly shiftOffsets?: ReadonlyArray<number>;
  readonly subPathOrdering?: ReadonlyArray<number>;
}
