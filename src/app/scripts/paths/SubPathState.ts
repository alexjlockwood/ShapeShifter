import * as _ from 'lodash';
import { CommandState } from './CommandState';
import { environment } from '../../../environments/environment';

/**
 * Container class that encapsulates a SubPath's underlying state.
 */
export class SubPathState {
  private readonly backingCommandIds: ReadonlyArray<string>;
  private readonly splitCommandIds: ReadonlyArray<string>;
  private readonly commandIds: ReadonlyArray<string>;
  private readonly pathString: string;

  constructor(
    private readonly commandStates: ReadonlyArray<CommandState>,
    private readonly isReversed_ = false,
    private readonly shiftOffset = 0,
    private readonly id = _.uniqueId(),
    // Either empty if this sub path is not split, or an array
    // containing this sub path's split children.
    private readonly splitSubPaths: ReadonlyArray<SubPathState> = [],
  ) {
    if (!environment.production) {
      // TODO: remove this at some point
      this.backingCommandIds = commandStates.map(cs => cs.getBackingId());
      this.splitCommandIds = commandStates.map(cs => cs.getSplitSegmentId());
      this.commandIds = commandStates.map(cs => cs.getCommands().map(c => c.getId()).join(' '));
      this.pathString = commandStates.map(cs => {
        return cs.getCommands().map(c => c.toString()).join(' ');
      }).join(' ');
    }
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
  ) { }

  setCommandStates(commandStates: CommandState[]) {
    this.commandStates = commandStates.slice();
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

export function findSplitSegmentParentNode(
  states: ReadonlyArray<SubPathState>,
  splitSegmentId: string): SubPathState {

  for (const state of states) {
    for (const sps of state.getSplitSubPaths()) {
      if (sps.getCommandStates().some(cs => cs.getSplitSegmentId() === splitSegmentId)) {
        return state;
      }
      const parent = findSplitSegmentParentNode([sps], splitSegmentId);
      if (parent) {
        return parent;
      }
    }
  }
  return undefined;
};
