import * as _ from 'lodash';
import { CommandState } from './pathstate';

export class SubPathState {

  constructor(
    public readonly commandStates: ReadonlyArray<CommandState>,
    public readonly isReversed = false,
    public readonly shiftOffset = 0,
    public readonly id = _.uniqueId(),
    // Either empty if this sub path is not split, or an array of size 2
    // containing this sub path's split children.
    public readonly splitSubPaths: ReadonlyArray<SubPathState> = [],
  ) { }

  mutate() {
    return new SubPathStateMutator(
      this.commandStates.slice(),
      this.isReversed,
      this.shiftOffset,
      this.id,
      this.splitSubPaths.slice(),
    );
  }

  revert() {
    return this.mutate().revert().build();
  }

  clone() {
    return this.mutate().build();
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
      if (!state.splitSubPaths.length) {
        subPathStates.push(state);
        return;
      }
      recurseFn(state.splitSubPaths);
    });
  })(map);
  return subPathStates;
}

export function isSubPathSplit(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  return !!findSubPathState(map, spsIdx).splitSubPaths.length;
}

export function isSubPathUnsplittable(map: ReadonlyArray<SubPathState>, spsIdx: number) {
  // Construct an array of parent nodes (one per leaf... meaning there will be duplicates).
  const subPathStatesParents: SubPathState[] = [];
  (function recurseFn(currentLevel: ReadonlyArray<SubPathState>, parent?: SubPathState) {
    currentLevel.forEach(state => {
      if (!state.splitSubPaths.length) {
        subPathStatesParents.push(parent);
        return;
      }
      recurseFn(state.splitSubPaths, state);
    });
  })(map);
  const parent = subPathStatesParents[spsIdx];
  return parent
    && parent.splitSubPaths.length
    && parent.splitSubPaths.every(s => !s.splitSubPaths.length);
}
