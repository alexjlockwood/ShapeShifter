import {
  ActionMode,
  AutoFixClick,
  DeleteActionSelections,
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
  private isActionMode_: boolean;
  private actionMode: ActionMode;

  constructor(private readonly store: Store<State>) {
    this.store.select(isActionMode).subscribe(isActive => this.isActionMode_ = isActive);
    this.store.select(getActionMode).subscribe(mode => this.actionMode = mode);
  }

  isActionMode() {
    return this.isActionMode_;
  }

  closeActionMode() {
    if (!this.isActionMode_) {
      return;
    }
    if (this.actionMode === ActionMode.Selection) {
      this.store.dispatch(new EndActionMode());
    } else {
      this.store.dispatch(new SetActionMode(ActionMode.Selection));
    }
  }

  deleteSelections() {
    if (this.actionMode !== ActionMode.Selection) {
      // TODO: determine if it makes sense to perform an action in this case
      return;
    }
    this.store.dispatch(new DeleteActionSelections());
  }

  toggleSplitCommandsMode() {
    this.store.dispatch(new ToggleActionMode(ActionMode.SplitCommands));
  }

  toggleSplitSubPathsMode() {
    this.store.dispatch(new ToggleActionMode(ActionMode.SplitSubPaths));
  }

  toggleMorphSubPathsMode() {
    this.store.dispatch(new ToggleActionMode(ActionMode.MorphSubPaths));
  }

  reverseSelectedSubPaths() {
    this.store.dispatch(new ReverseSelectedSubPaths());
  }

  shiftBackSelectedSubPaths() {
    this.store.dispatch(new ShiftBackSelectedSubPaths());
  }

  shiftForwardSelectedSubPaths() {
    this.store.dispatch(new ShiftForwardSelectedSubPaths());
  }

  shiftPointToFront() {
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
