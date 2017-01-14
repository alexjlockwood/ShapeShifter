import * as _ from 'lodash';
import { ICommand, IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
import {
  DrawCommand, MoveCommand, LineCommand, ClosePathCommand, EllipticalArcCommand
} from './drawcommand';

export class SubPathCommand implements ISubPathCommand {

  static from(drawCommands: DrawCommand[]) {
    if (!drawCommands.length) {
      return [];
    }
    const cmdGroups: DrawCommand[][] = [];
    let currentCmdList = [];
    for (let i = drawCommands.length - 1; i >= 0; i--) {
      const cmd = drawCommands[i];
      currentCmdList.push(cmd);
      if (cmd instanceof MoveCommand) {
        cmdGroups.push(currentCmdList);
        currentCmdList = [];
      }
    }
    return cmdGroups.reverse().map(cmds => new SubPathCommand(...cmds.reverse()));
  }

  private id_: string;
  private commands_: DrawCommand[];

  constructor(...commands: DrawCommand[]) { this.commands_ = commands; }

  // Overrides ICommand interface.
  set id(id: string) { this.id_ = id; }

  // Overrides ICommand interface.
  get id() { return this.id_; }

  get commands() { return this.commands_; }

  isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.x === end.x && start.y === end.y;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  reverse() {
    const firstMoveCommand = this.commands[0];
    if (this.commands.length === 1) {
      this.reverseDrawCommand(firstMoveCommand);
      return;
    }
    const cmds = this.commands;
    const newCmds: DrawCommand[] = [
      new MoveCommand(firstMoveCommand.start, _.last(cmds).end)
    ];
    for (let i = cmds.length - 1; i >= 1; i--) {
      this.reverseDrawCommand(cmds[i]);
      newCmds.push(cmds[i]);
    }
    const secondCmd = newCmds[1];
    if (secondCmd instanceof ClosePathCommand) {
      newCmds[1] = new LineCommand(secondCmd.start, secondCmd.end);
      const lastCmd = _.last(newCmds);
      newCmds[newCmds.length - 1] =
        new ClosePathCommand(lastCmd.start, lastCmd.end);
    }
    this.commands_ = newCmds;
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftForward() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    // TODO(alockwood): make this more efficient... :P
    for (let i = 0; i < this.commands.length - 2; i++) {
      this.shiftBack();
    }
  }

  // TODO(alockwood): add a test for commands with multiple moves but no close paths
  shiftBack() {
    if (this.commands.length === 1 || !this.isClosed()) {
      return;
    }

    const newCmdLists: DrawCommand[][] = [];
    const cmds = this.commands;
    const moveStartPoint = cmds[0].start;
    cmds.unshift(cmds.pop());

    if (cmds[0] instanceof ClosePathCommand) {
      const lastCmd = _.last(cmds);
      cmds[cmds.length - 1] = new ClosePathCommand(lastCmd.start, lastCmd.end);
      cmds[1] = new LineCommand(cmds[0].start, cmds[0].end);
    } else {
      cmds[1] = cmds[0];
    }
    // TODO(alockwood): confirm that this start point is correct for paths w/ multiple moves
    cmds[0] = new MoveCommand(moveStartPoint, cmds[1].start);
  }

  private reverseDrawCommand(cmd: DrawCommand) {
    if (cmd instanceof EllipticalArcCommand) {
      const endX = cmd.args[0];
      const endY = cmd.args[1];
      cmd.args[0] = cmd.args[7];
      cmd.args[1] = cmd.args[8];
      cmd.args[6] = cmd.args[6] === 0 ? 1 : 0;
      cmd.args[7] = endX;
      cmd.args[8] = endY;
    } else if (!(cmd instanceof MoveCommand) || cmd.start) {
      cmd.points.reverse();
    }
  }
}
