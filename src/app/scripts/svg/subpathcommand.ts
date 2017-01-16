import * as _ from 'lodash';
import { Point } from '../common';
import { PathCommand, SubPathCommand, DrawCommand } from '../model';
import { DrawCommandImpl } from './drawcommand';

/**
 * Implementation of the SubPathCommand interface. A PathCommand is split up
 * into multiple SubPathCommands, each beginning with a 'move to' draw command.
 */
export class SubPathCommandImpl implements SubPathCommand {

  // TODO: make sure paths with one M and multiple Zs are treated as multiple sub paths
  private readonly commands_: ReadonlyArray<DrawCommandImpl>;
  private readonly points_: ReadonlyArray<{point: Point, isSplit: boolean}>;

  static from(...drawCommands: DrawCommandImpl[]): SubPathCommandImpl[] {
    if (!drawCommands.length) {
      return [];
    }
    const cmdGroups: DrawCommandImpl[][] = [];
    let currentCmdList = [];
    for (let i = drawCommands.length - 1; i >= 0; i--) {
      const cmd = drawCommands[i];
      currentCmdList.push(cmd);
      if (cmd.svgChar === 'M') {
        cmdGroups.push(currentCmdList);
        currentCmdList = [];
      }
    }
    return cmdGroups.reverse().map(cmds => new SubPathCommandImpl(...cmds.reverse()));
  }

  constructor(...commands: DrawCommandImpl[]) {
    this.commands_ = commands;
    this.points_ = _.flatMap(this.commands_, cmd => {
      if (cmd.svgChar === 'Z') {
        return [];
      }
      return [{point: _.last(cmd.points), isSplit: cmd.isSplit}];
    });
  }

  // Overrides SubPathCommand interface.
  get commands() { return this.commands_; }

  // Overrides SubPathCommand interface.
  get isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.equals(end);
  }

  // Overrides SubPathCommand interface.
  get points() {
    return this.points_;
  }
}
