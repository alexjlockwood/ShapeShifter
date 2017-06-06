import {
  ActionMode,
  AutoFixClick,
  DeleteSelectedPoints,
  DeleteSelectedSegments,
  DeleteSelectedSubPaths,
  EndActionMode,
  ReverseSelectedSubPaths,
  SetActionMode,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  State,
  Store,
  ToggleActionMode,
} from '../store';
import {
  getActionMode,
  isActionMode,
} from '../store/actionmode/selectors';
import { Injectable } from '@angular/core';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {
  private isActionMode: boolean;
  private actionMode: ActionMode;

  constructor(private readonly store: Store<State>) {
    this.store.select(isActionMode).subscribe(isActive => this.isActionMode = isActive);
    this.store.select(getActionMode).subscribe(mode => this.actionMode = mode);
  }

  closeActionMode() {
    if (!this.isActionMode) {
      return;
    }
    if (this.actionMode === ActionMode.Selection) {
      this.store.dispatch(new EndActionMode());
    } else {
      this.store.dispatch(new SetActionMode(ActionMode.Selection));
    }
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

  autoFixClick() {
    this.store.dispatch(new AutoFixClick());
  }
}
