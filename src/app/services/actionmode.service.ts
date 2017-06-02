import {
  ActionMode,
  ClearActivePathBlockId,
  DeleteSelectedPoints,
  DeleteSelectedSegments,
  DeleteSelectedSubPaths,
  ReverseSelectedSubPaths,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  State,
  Store,
  ToggleActionMode,
} from '../store';
import { Injectable } from '@angular/core';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {

  constructor(private readonly store: Store<State>) { }

  closeActionMode() {
    this.store.dispatch(new ClearActivePathBlockId());
  }

  toggleSplitCommandsMode() {
    // TODO: prefer already selected subpaths over others when creating new points?
    this.store.dispatch(new ToggleActionMode(ActionMode.SplitCommands));
  }

  toggleSplitSubPathsMode() {
    // TODO: prefer already selected subpaths over others when splitting new subpaths?
    this.store.dispatch(new ToggleActionMode(ActionMode.SplitSubPaths));
  }

  toggleMorphSubPathsMode() {
    this.store.dispatch(new ToggleActionMode(ActionMode.MorphSubPaths));
  }

  reversePoints() {
    this.store.dispatch(new ReverseSelectedSubPaths());
  }

  shiftBackPoints() {
    this.store.dispatch(new ShiftBackSelectedSubPaths());
  }

  shiftForwardPoints() {
    this.store.dispatch(new ShiftForwardSelectedSubPaths());
  }

  deleteSubPaths() {
    this.store.dispatch(new DeleteSelectedSubPaths())
  }

  deleteSegments() {
    this.store.dispatch(new DeleteSelectedSegments())
  }

  deletePoints() {
    this.store.dispatch(new DeleteSelectedPoints())
  }

  setFirstPosition() {
    this.store.dispatch(new ShiftPointToFront());
  }

  splitInHalfHover(isHovering: boolean) {
    this.store.dispatch(new SplitCommandInHalfHover(isHovering))
  }

  splitInHalfClick() {
    this.store.dispatch(new SplitCommandInHalfClick())
  }
}
