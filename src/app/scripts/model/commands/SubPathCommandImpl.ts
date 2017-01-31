import * as _ from 'lodash';
import { Point } from '../../common';
import { PathCommand, SubPathCommand, Command } from '.';

/**
 * Implementation of the SubPathCommand interface. A PathCommand is split up
 * into multiple SubPathCommands, each beginning with a 'move to' draw command.
 */
class SubPathCommandImpl implements SubPathCommand {

  // TODO: make sure paths with one M and multiple Zs are treated as multiple sub paths
  private readonly drawCommands_: ReadonlyArray<Command>;
  private readonly points_: ReadonlyArray<{ point: Point, isSplit: boolean }>;

  constructor(commands: Command[]) {
    this.drawCommands_ = commands;
    this.points_ = _.flatMap(commands, cmd => {
      if (cmd.svgChar === 'Z') {
        return [];
      }
      return [{ point: _.last(cmd.points), isSplit: !!cmd.isSplit }];
    });
  }

  // Implements the SubPathCommand interface.
  get commands(): ReadonlyArray<Command> {
    return this.drawCommands_;
  }

  // Implements the SubPathCommand interface.
  get isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    return start.equals(end);
  }

  // Implements the SubPathCommand interface.
  get points() {
    return this.points_;
  }
}

export function createSubPathCommand(...commands: Command[]): SubPathCommand {
  return new SubPathCommandImpl(commands);
}
