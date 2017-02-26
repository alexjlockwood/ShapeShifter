import * as _ from 'lodash';
import { Point } from '../common';
import { SubPathCommand, Command } from '.';

export function newSubPathCommand(commands: Command[]): SubPathCommand {
  // Precondition: must have exactly 1 move command and at most 1 closepath command.
  return new SubPathCommandImpl(commands.slice());
}

/**
 * Implementation of the SubPathCommand interface. A PathCommand is split up
 * into multiple SubPathCommands, each beginning with a 'move to' command.
 */
class SubPathCommandImpl implements SubPathCommand {
  private readonly commands: ReadonlyArray<Command>;

  constructor(commands: ReadonlyArray<Command>) {
    this.commands = commands;
  }

  // Implements the SubPathCommand interface.
  getCommands() {
    return this.commands;
  }

  // Implements the SubPathCommand interface.
  isClosed() {
    const start = _.first(this.getCommands()).end;
    const end = _.last(this.getCommands()).end;
    return start.equals(end);
  }
}

