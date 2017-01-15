import * as _ from 'lodash';
import { IPathCommand, ISubPathCommand, IDrawCommand } from '../model';
import { DrawCommand } from './drawcommand';

/**
 * Implementation of the ISubPathCommand interface. An IPathCommand is split up
 * into multiple ISubPathCommands, each beginning with a 'move to' draw command.
 */
export class SubPathCommand implements ISubPathCommand {

  // TODO: make sure paths with one M and multiple Zs are treated as multiple sub paths
  private readonly commands_: ReadonlyArray<DrawCommand>;

  static from(...drawCommands: DrawCommand[]): SubPathCommand[] {
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

  constructor(...commands: DrawCommand[]) { this.commands_ = commands; }

  get commands() { return this.commands_; }

  get isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.equals(end);
  }
}
