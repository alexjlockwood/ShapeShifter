import * as _ from 'lodash';
import { CommandState } from './CommandState';
import { Command } from '.';

export class SubPathState {

  constructor(
    public readonly commandStates: ReadonlyArray<CommandState>,
    public readonly isReversed = false,
    // A shift offset value of 'x' means 'perform x shift back ops'.
    public readonly shiftOffset = 0,
    public readonly id = _.uniqueId(),
    // Either empty if this sub path is not split, or an array of size 2
    // containing this sub path's split children.
    public readonly splitSubPaths: ReadonlyArray<SubPathState> = [],
    public readonly isUnsplittable = false,
  ) { }

  isSplit() {
    return !!this.splitSubPaths.length;
  }

  mutate() {
    return new SubPathStateMutator(
      this.commandStates.slice(),
      this.isReversed,
      this.shiftOffset,
      this.id,
      this.splitSubPaths.slice(),
      this.isUnsplittable,
    );
  }

  revert(): SubPathState {
    return this.mutate().revert().build();
  }

  clone(): SubPathState {
    return this.mutate().build();
  }

  toSubPathCommands(): Command[][] {
    if (!this.splitSubPaths.length) {
      return [reverseAndShiftCommands(this)];
    }
    const subPathCommands: Command[][] = [];
    for (const splitSubPath of this.splitSubPaths) {
      subPathCommands.push(...splitSubPath.toSubPathCommands());
    }
    return subPathCommands;
  }
}

/**
 * Builder class for creating new SubPathState objects.
 */
class SubPathStateMutator {

  constructor(
    private commandStates: CommandState[],
    private isReversed: boolean,
    private shiftOffset: number,
    private id: string,
    private splitSubPaths: ReadonlyArray<SubPathState>,
    private isUnsplittable: boolean,
  ) { }

  setCommandStates(commandStates: CommandState[]) {
    this.commandStates = commandStates.slice();
    return this;
  }

  setCommandState(commandState: CommandState, index: number) {
    if (!this.commandStates || this.commandStates.length <= index) {
      throw new Error('Attempt to set a CommandState object using an invalid index');
    }
    this.commandStates[index] = commandState;
    return this;
  }

  reverse() {
    return this.setIsReversed(!this.isReversed);
  }

  setIsReversed(isReversed: boolean) {
    this.isReversed = isReversed;
    return this;
  }

  setShiftOffset(shiftOffset: number) {
    this.shiftOffset = shiftOffset;
    return this;
  }

  setSplitSubPaths(splitSubPaths: SubPathState[]) {
    this.splitSubPaths = splitSubPaths.slice();
    return this;
  }

  setId(id: string) {
    this.id = id;
    return this;
  }

  setIsUnsplittable(isDeletable: boolean) {
    this.isUnsplittable = isDeletable;
    return this;
  }

  revert() {
    this.commandStates = this.commandStates.map(cs => cs.mutate().revert().build());
    this.isReversed = false;
    this.shiftOffset = 0;
    this.splitSubPaths = [];
    this.isUnsplittable = false;
    return this;
  }

  build() {
    return new SubPathState(
      this.commandStates,
      this.isReversed,
      this.shiftOffset,
      this.id,
      this.splitSubPaths,
      this.isUnsplittable,
    );
  }
}

function reverseAndShiftCommands(subPathState: SubPathState) {
  return shiftCommands(subPathState, reverseCommands(subPathState));
}

function reverseCommands(subPathState: SubPathState) {
  const subPathCms = subPathState.commandStates;
  const hasOneCmd =
    subPathCms.length === 1 && subPathCms[0].getCommands().length === 1;
  if (hasOneCmd || !subPathState.isReversed) {
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

export function findSubPathState(map: ReadonlyArray<SubPathState>, cmsIdx: number) {
  let subPathState: SubPathState;
  let counter = 0;
  (function recurseFn(states: ReadonlyArray<SubPathState>) {
    for (const state of states) {
      if (!state.isSplit()) {
        if (counter++ === cmsIdx) {
          subPathState = state;
          return;
        }
        continue;
      }
      recurseFn(state.splitSubPaths);
    }
  })(map);
  return subPathState;
}

export function isSubPathSplit(map: ReadonlyArray<SubPathState>, cmsIdx: number) {
  let isSubPathSplit = false;
  let counter = 0;
  (function recurseFn(states: ReadonlyArray<SubPathState>, isSplit = false) {
    for (const state of states) {
      if (!state.isSplit()) {
        if (counter++ === cmsIdx) {
          isSubPathSplit = isSplit;
          return;
        }
        continue;
      }
      recurseFn(state.splitSubPaths, true);
    }
  })(map);
  return isSubPathSplit;
}

export function countSubPathStates(map: ReadonlyArray<SubPathState>): number {
  let counter = 0;
  (function recurseFn(states: ReadonlyArray<SubPathState>) {
    states.forEach(state => {
      if (!state.isSplit()) {
        counter++;
        return;
      }
      recurseFn(state.splitSubPaths);
    });
  })(map);
  return counter;
}

export function flattenSubPathStates(map: ReadonlyArray<SubPathState>) {
  const subPathStates: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>) {
    currentLevel.forEach(state => {
      if (!state.isSplit()) {
        subPathStates.push(state);
        return;
      }
      recurseFn(state.splitSubPaths);
    });
  })(map);
  return subPathStates;
}
