import * as _ from 'lodash';

import { CommandState } from './CommandState';

/**
 * Container class that encapsulates a SubPath's underlying state.
 */
export class SubPathState {
  constructor(
    private readonly commandStates: ReadonlyArray<CommandState>,
    private readonly isReversed_ = false,
    private readonly shiftOffset = 0,
    private readonly id = _.uniqueId(),
    // Either empty if this sub path is not split, or an array
    // containing this sub path's split children.
    private readonly splitSubPaths: ReadonlyArray<SubPathState> = [],
  ) {}

  getId() {
    return this.id;
  }

  getCommandStates() {
    return this.commandStates;
  }

  isReversed() {
    return this.isReversed_;
  }

  getShiftOffset() {
    return this.shiftOffset;
  }

  getSplitSubPaths() {
    return this.splitSubPaths;
  }

  revert() {
    return this.mutate().revert().build();
  }

  clone() {
    return this.mutate().build();
  }

  mutate() {
    return new SubPathStateMutator(
      [...this.commandStates],
      this.isReversed_,
      this.shiftOffset,
      this.id,
      [...this.splitSubPaths],
    );
  }
}

/**
 * Builder class for creating new SubPathState objects.
 */
export class SubPathStateMutator {
  constructor(
    private commandStates: CommandState[],
    private isReversed: boolean,
    private shiftOffset: number,
    private id: string,
    private splitSubPaths: ReadonlyArray<SubPathState>,
  ) {}

  setCommandStates(commandStates: CommandState[]) {
    this.commandStates = [...commandStates];
    return this;
  }

  setCommandState(index: number, commandState: CommandState) {
    if (!this.commandStates || this.commandStates.length <= index) {
      throw new Error('Attempt to set a CommandState object using an invalid index');
    }
    this.commandStates[index] = commandState;
    return this;
  }

  reverse() {
    return this.setIsReversed(!this.isReversed);
  }

  setIsReversed(isReversed: boolean) {
    this.isReversed = isReversed;
    return this;
  }

  setShiftOffset(shiftOffset: number) {
    this.shiftOffset = shiftOffset;
    return this;
  }

  setSplitSubPaths(splitSubPaths: SubPathState[]) {
    this.splitSubPaths = [...splitSubPaths];
    return this;
  }

  setId(id: string) {
    this.id = id;
    return this;
  }

  revert() {
    this.commandStates = this.commandStates.map(cs => cs.mutate().revert().build());
    this.isReversed = false;
    this.shiftOffset = 0;
    this.splitSubPaths = [];
    return this;
  }

  build() {
    return new SubPathState(
      this.commandStates,
      this.isReversed,
      this.shiftOffset,
      this.id,
      this.splitSubPaths,
    );
  }
}

export function findSubPathState(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  return flattenSubPathStates(map)[spsIdx];
}

export function flattenSubPathStates(map: ReadonlyArray<SubPathState>) {
  const subPathStates: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>) {
    currentLevel.forEach(state => {
      if (!state.getSplitSubPaths().length) {
        subPathStates.push(state);
        return;
      }
      recurseFn(state.getSplitSubPaths());
    });
  })(map);
  return subPathStates;
}
