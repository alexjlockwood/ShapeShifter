import * as _ from 'lodash';
import { Point } from '../common';
import { SubPathCommand, Command } from '.';

export function newSubPathCommand(...commands: Command[]): SubPathCommand {
  return new SubPathCommandImpl(commands);
}

/**
 * Implementation of the SubPathCommand interface. A PathCommand is split up
 * into multiple SubPathCommands, each beginning with a 'move to' command.
 */
class SubPathCommandImpl implements SubPathCommand {

  // TODO: make sure paths with one M and multiple Zs are treated as multiple sub paths
  private readonly commands_: ReadonlyArray<Command>;

  constructor(commands: Command[]) {
    this.commands_ = commands.slice();
  }

  // Implements the SubPathCommand interface.
  get commands() {
    return this.commands_;
  }

  // Implements the SubPathCommand interface.
  get isClosed() {
    const start = _.first(this.commands).end;
    const end = _.last(this.commands).end;
    return start.equals(end);
  }
}

