import 'rxjs/add/operator/combineLatest';

import {
  ActionMode,
  ActionSource,
  AutoFixClick,
  DeleteActionModeSelections,
  EndActionMode,
  Hover,
  HoverType,
  ReverseSelectedSubPaths,
  SetActionMode,
  SetActionModeHover,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  State,
  Store,
} from '../store';
import {
  getActionMode,
  getActionModeHover,
  getActionModePointSelections,
  isActionMode,
} from '../store/actionmode/selectors';
import { Injectable } from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {

  constructor(private readonly store: Store<State>) { }

  isActionMode() {
    let result: boolean;
    this.store.select(isActionMode).first().subscribe(isActive => result = isActive);
    return result;
  }

  closeActionMode() {
    // TODO: create a default ActionMode.None constant or something to avoid this
    Observable.combineLatest(
      this.store.select(isActionMode),
      this.store.select(getActionMode),
    ).first().subscribe(([isActive, actionMode]) => {
      if (!isActive) {
        return;
      }
      if (actionMode === ActionMode.Selection) {
        this.store.dispatch(new EndActionMode());
      } else {
        this.store.dispatch(new SetActionMode(ActionMode.Selection));
      }
    });
  }

  deleteSelections() {
    this.store.select(getActionMode).first().subscribe(currentMode => {
      if (currentMode === ActionMode.Selection) {
        this.store.dispatch(new DeleteActionModeSelections());
      }
    });
  }

  toggleSplitCommandsMode() {
    this.toggleActionMode(ActionMode.SplitCommands);
  }

  toggleSplitSubPathsMode() {
    this.toggleActionMode(ActionMode.SplitSubPaths);
  }

  toggleMorphSubPathsMode() {
    this.toggleActionMode(ActionMode.MorphSubPaths);
  }

  private toggleActionMode(modeToToggle: ActionMode) {
    this.store.select(getActionMode).first().subscribe(currentMode => {
      const newMode = currentMode === modeToToggle ? ActionMode.Selection : modeToToggle;
      this.store.dispatch(new SetActionMode(newMode));
    });
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

  autoFixClick() {
    this.store.dispatch(new AutoFixClick());
  }

  splitInHalfClick() {
    this.store.dispatch(new SplitCommandInHalfClick());
  }

  splitInHalfHover() {
    this.store.select(getActionModePointSelections).take(1).subscribe(selections => {
      if (selections.length) {
        const { source, subIdx, cmdIdx } = selections[0];
        this.setHover({ type: HoverType.Split, source, subIdx, cmdIdx });
      }
    });
  }

  setHover(newHover: Hover) {
    this.store.select(getActionModeHover).first().subscribe(currHover => {
      if (!_.isEqual(newHover, currHover)) {
        this.store.dispatch(new SetActionModeHover(newHover));
      }
    });
  }

  clearHover() {
    this.setHover(undefined);
  }
}
