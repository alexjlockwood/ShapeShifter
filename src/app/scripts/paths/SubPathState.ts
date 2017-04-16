import * as _ from 'lodash';
import { CommandState } from './CommandState';

/**
 * Container class that encapsulates a SubPath's underlying state.
 */
export class SubPathState {
  private readonly backingCommandIds: ReadonlyArray<string>;
  private readonly splitCommandIds: ReadonlyArray<string>;
  private readonly commandIds: ReadonlyArray<string>;

  constructor(
    private readonly commandStates: ReadonlyArray<CommandState>,
    private readonly isReversed_ = false,
    private readonly shiftOffset = 0,
    private readonly id = _.uniqueId(),
    // Either empty if this sub path is not split, or an array
    // containing this sub path's split children.
    private readonly splitSubPaths: ReadonlyArray<SubPathState> = [],
    private readonly splitBackingCommandIds: ReadonlyArray<string> = [],
  ) {
    this.backingCommandIds = commandStates.map(cs => cs.getBackingCommandId());
    this.splitCommandIds = commandStates.map(cs => cs.getSplitSegmentId());
    this.commandIds = commandStates.map(cs => cs.getCommands().map(c => c.getId()).join(' '));
  }

  getSplitBackingCommandIds() {
    return this.splitBackingCommandIds;
  }

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
      this.commandStates.slice(),
      this.isReversed_,
      this.shiftOffset,
      this.id,
      this.splitSubPaths.slice(),
      this.splitBackingCommandIds.slice(),
    );
  }
}

/**
 * Builder class for creating new SubPathState objects.
 */
class SubPathStateMutator {

  constructor(
    private commandStates: CommandState[],
    private isReversed: boolean,
    private shiftOffset: number,
    private id: string,
    private splitSubPaths: ReadonlyArray<SubPathState>,
    private splitBackingCommandIds: ReadonlyArray<string>,
  ) { }

  setSplitBackingCommandIds(ids: string[]) {
    this.splitBackingCommandIds = ids.slice();
    return this;
  }

  setCommandStates(commandStates: CommandState[]) {
    this.commandStates = commandStates.slice();
    return this;
  }

  setCommandState(commandState: CommandState, index: number) {
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
    this.splitSubPaths = splitSubPaths.slice();
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
    this.splitBackingCommandIds = [];
    return this;
  }

  build() {
    return new SubPathState(
      this.commandStates,
      this.isReversed,
      this.shiftOffset,
      this.id,
      this.splitSubPaths,
      this.splitBackingCommandIds,
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
