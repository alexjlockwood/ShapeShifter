import * as _ from 'lodash';
import { ICommand, IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
import { DrawCommand } from './drawcommand';

/**
 * Implementation of the ISubPathCommand interface. An IPathCommand is split up
 * into multiple ISubPathCommands, each beginning with a 'move to' draw command.
 */
export class SubPathCommand implements ISubPathCommand {

  static from(...drawCommands: DrawCommand[]) {
    if (!drawCommands.length) {
      return [];
    }
    const cmdGroups: DrawCommand[][] = [];
    let currentCmdList = [];
    for (let i = drawCommands.length - 1; i >= 0; i--) {
      const cmd = drawCommands[i];
      currentCmdList.push(cmd);
      if (cmd.svgChar === 'M') {
        cmdGroups.push(currentCmdList);
        currentCmdList = [];
      }
    }
    return cmdGroups.reverse().map(cmds => new SubPathCommand(...cmds.reverse()));
  }

  private readonly commands_: ReadonlyArray<DrawCommand>;

  private constructor(...commands: DrawCommand[]) { this.commands_ = commands; }

  get commands() { return this.commands_; }

  get isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.x === end.x && start.y === end.y;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const firstMoveCommand = this.commands[0];
    if (this.commands.length === 1) {
      return new SubPathCommand(firstMoveCommand.reverse());
    }
    const cmds = this.commands;
    const newCmds: DrawCommand[] = [
      DrawCommand.moveTo(firstMoveCommand.start, _.last(cmds).end),
    ];
    for (let i = cmds.length - 1; i >= 1; i--) {
      newCmds.push(cmds[i].reverse());
    }
    const secondCmd = newCmds[1];
    if (secondCmd.svgChar === 'Z') {
      newCmds[1] = DrawCommand.lineTo(secondCmd.start, secondCmd.end);
      const lastCmd = _.last(newCmds);
      newCmds[newCmds.length - 1] =
        DrawCommand.closePath(lastCmd.start, lastCmd.end);
    }
    return new SubPathCommand(...newCmds);
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    if (this.commands.length === 1 || !this.isClosed) {
      return this;
    }

    // TODO(alockwood): make this more efficient... :P
    let result: SubPathCommand = this;
    for (let i = 0; i < this.commands.length - 2; i++) {
      result = result.shiftBack();
    }
    return result;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    if (this.commands.length === 1 || !this.isClosed) {
      return this;
    }

    const newCmdLists: DrawCommand[][] = [];
    const cmds = this.commands.slice();
    const moveStartPoint = cmds[0].start;
    cmds.unshift(cmds.pop());

    if (cmds[0].svgChar === 'Z') {
      const lastCmd = _.last(cmds);
      cmds[cmds.length - 1] = DrawCommand.closePath(lastCmd.start, lastCmd.end);
      cmds[1] = DrawCommand.lineTo(cmds[0].start, cmds[0].end);
    } else {
      cmds[1] = cmds[0];
    }
    // TODO(alockwood): confirm that this start point is correct for paths w/ multiple moves
    cmds[0] = DrawCommand.moveTo(moveStartPoint, cmds[1].start);

    return new SubPathCommand(...cmds);
  }
}
