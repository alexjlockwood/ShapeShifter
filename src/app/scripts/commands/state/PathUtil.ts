import * as _ from 'lodash';
import { CommandState } from './CommandState';
import { CommandImpl } from '../Commandimpl';
import { Command, newMove, newLine } from '..';

export function reverseAndShiftCommands(
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

function shiftCommands(
  cmds: CommandImpl[],
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
