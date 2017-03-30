import * as _ from 'lodash';
import { SubPath, Command } from '.';

/**
 * Implementation of the SubPath interface.
 */
class SubPathImpl implements SubPath {

  constructor(
    private readonly commands: ReadonlyArray<Command>,
    private readonly id = _.uniqueId(),
    private readonly isCollapsing_ = false,
    private readonly isReversed_ = false,
    private readonly shiftOffset = 0,
    private readonly isSplit_ = false,
    private readonly isUnsplittable_ = false,
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
  isCollapsing() {
    return this.isCollapsing_;
  }

  // Implements the SubPath interface.
  isReversed() {
    return this.isReversed_;
  }

  // Implements the SubPath interface.
  getShiftOffset() {
    return this.shiftOffset;
  }

  // Implements the SubPath interface.
  isSplit() {
    return this.isSplit_;
  }

  // Implements the SubPath interface.
  isUnsplittable() {
    return this.isUnsplittable_;
  }

  // Implements the SubPath interface.
  isClosed() {
    const start = _.first(this.getCommands()).getEnd();
    const end = _.last(this.getCommands()).getEnd();
    return start.equals(end);
  }

  // Implements the SubPath interface.
  mutate() {
    return new SubPathBuilder(
      this.commands,
      this.id,
      this.isCollapsing_,
      this.isReversed_,
      this.shiftOffset,
      this.isSplit_,
      this.isUnsplittable_,
    );
  }
}

export function createSubPaths(commands: ReadonlyArray<Command>) {
  if (!commands.length || commands[0].getSvgChar() !== 'M') {
    // TODO: is this case actually possible? should we insert 'M 0 0' instead?
    return [];
  }

  let currentCmdList: Command[] = [];
  let lastSeenMove: Command;
  const subPathCmds: SubPath[] = [];
  for (const cmd of commands) {
    if (cmd.getSvgChar() === 'M') {
      lastSeenMove = cmd;
      if (currentCmdList.length) {
        subPathCmds.push(newSubPath(currentCmdList));
        currentCmdList = [];
      } else {
        currentCmdList.push(cmd);
      }
      continue;
    }
    if (!currentCmdList.length) {
      currentCmdList.push(lastSeenMove);
    }
    currentCmdList.push(cmd);
    if (cmd.getSvgChar() === 'Z') {
      subPathCmds.push(newSubPath(currentCmdList));
      currentCmdList = [];
    }
  }
  if (currentCmdList.length) {
    subPathCmds.push(newSubPath(currentCmdList));
  }
  return subPathCmds;
}

function newSubPath(commands: ReadonlyArray<Command>): SubPath {
  // Precondition: must have exactly 1 move command and at most 1 closepath command.
  return new SubPathImpl(commands.slice());
}

export class SubPathBuilder {

  constructor(
    private commands: ReadonlyArray<Command>,
    private id: string,
    private isCollapsing: boolean,
    private isReversed: boolean,
    private shiftOffset: number,
    private isSplit: boolean,
    private isUnsplittable: boolean,
  ) { }

  setCommands(commands: Command[]) {
    this.commands = commands;
    return this;
  }

  setId(id: string) {
    this.id = id;
    return this;
  }

  setIsCollapsing(isCollapsing: boolean) {
    this.isCollapsing = isCollapsing;
    return this;
  }

  setIsReversed(isReversed: boolean) {
    this.isReversed = isReversed;
    return this;
  }

  setShiftOffset(shiftOffset: number) {
    this.shiftOffset = shiftOffset;
    return this;
  }

  setIsSplit(isSplit: boolean) {
    this.isSplit = isSplit;
    return this;
  }

  setIsUnsplittable(isUnsplittable: boolean) {
    this.isUnsplittable = isUnsplittable;
    return this;
  }

  build() {
    return new SubPathImpl(
      this.commands.slice(),
      this.id,
      this.isCollapsing,
      this.isReversed,
      this.shiftOffset,
      this.isSplit,
      this.isUnsplittable,
    );
  }
}
