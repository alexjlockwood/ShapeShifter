import * as _ from 'lodash';
import { SubPath, Command } from '.';

export function newSubPath(id: string, commands: ReadonlyArray<Command>): SubPath {
  // Precondition: must have exactly 1 move command and at most 1 closepath command.
  return new SubPathImpl(id, commands.slice());
}

/**
 * Implementation of the SubPath interface.
 */
class SubPathImpl implements SubPath {

  constructor(
    private readonly id: string,
    private readonly commands: ReadonlyArray<Command>,
  ) { }

  // Implements the SubPath interface.
  getId() {
    return this.id;
  }

  // Implements the SubPath interface.
  getCommands() {
    return this.commands;
  }

  // Implements the SubPath interface.
  isClosed() {
    const start = _.first(this.getCommands()).getEnd();
    const end = _.last(this.getCommands()).getEnd();
    return start.equals(end);
  }
}

