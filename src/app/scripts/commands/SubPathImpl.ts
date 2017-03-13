import * as _ from 'lodash';
import { Point } from '../common';
import { SubPath, Command } from '.';

export function newSubPath(commands: ReadonlyArray<Command>): SubPath {
  // Precondition: must have exactly 1 move command and at most 1 closepath command.
  return new SubPathImpl(commands.slice());
}

/**
 * Implementation of the SubPath interface. A Path is split up into multiple
 * SubPaths, each beginning with a 'move to' command.
 */
class SubPathImpl implements SubPath {
  private readonly commands: ReadonlyArray<Command>;

  constructor(commands: ReadonlyArray<Command>) {
    this.commands = commands;
  }

  // Implements the SubPath interface.
  getCommands() {
    return this.commands;
  }

  // Implements the SubPath interface.
  isClosed() {
    const start = _.first(this.getCommands()).end;
    const end = _.last(this.getCommands()).end;
    return start.equals(end);
  }
}

