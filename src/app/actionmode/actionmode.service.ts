import { Injectable } from '@angular/core';
import { Path } from 'app/scripts/model/paths';
import {
  State,
  Store,
} from 'app/store';
import {
  ActionMode,
  ActionSource,
  Hover,
  HoverType,
  Selection,
} from 'app/store/actionmode';
import {
  SetActionMode,
  SetActionModeHover,
  SetActionModeSelections,
  StartActionMode,
  TogglePointSelection,
  ToggleSegmentSelections,
  ToggleSubPathSelection,
} from 'app/store/actionmode/actions';
import {
  AutoFixClick,
  DeleteActionModeSelections,
  PairSubPath,
  ReverseSelectedSubPaths,
  SetUnpairedSubPath,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  UpdateActivePathBlock,
} from 'app/store/actionmode/metaactions';
import {
  getActionMode,
  getActionModeHover,
  getActionModePointSelections,
} from 'app/store/actionmode/selectors';
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
    this.store.select(getActionMode)
      .first()
      .subscribe(mode => result = (mode !== ActionMode.None));
    return result;
  }

  startActionMode(blockId: string) {
    this.store.dispatch(new StartActionMode(blockId));
  }

  setActionMode(mode: ActionMode) {
    this.store.dispatch(new SetActionMode(mode));
  }

  closeActionMode() {
    this.store.select(getActionMode).first().subscribe(mode => {
      if (mode === ActionMode.None) {
        return;
      }
      if (mode === ActionMode.Selection) {
        this.store.dispatch(new SetActionMode(ActionMode.None));
      } else {
        this.store.dispatch(new SetActionMode(ActionMode.Selection));
      }
    });
  }

  setSelections(selections: ReadonlyArray<Selection>) {
    this.store.dispatch(new SetActionModeSelections(selections));
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
      if (currentMode === ActionMode.None) {
        return;
      }
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
    this.store.select(getActionModePointSelections).first().subscribe(selections => {
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

  pairSubPath(subIdx: number, source: ActionSource) {
    this.store.dispatch(new PairSubPath(subIdx, source));
  }

  setUnpairedSubPath(unpair: { subIdx: number, source: ActionSource }) {
    this.store.dispatch(new SetUnpairedSubPath(unpair));
  }

  updateActivePathBlock(source: ActionSource, path: Path) {
    this.store.dispatch(new UpdateActivePathBlock(source, path));
  }

  togglePointSelection(
    source: ActionSource,
    subIdx: number,
    cmdIdx: number,
    isShiftOrMetaPressed: boolean,
  ) {
    this.store.dispatch(
      new TogglePointSelection(source, subIdx, cmdIdx, isShiftOrMetaPressed));
  }

  toggleSegmentSelections(
    source: ActionSource,
    segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>,
  ) {
    this.store.dispatch(new ToggleSegmentSelections(source, segments));
  }

  toggleSubPathSelection(
    source: ActionSource,
    subIdx: number,
  ) {
    this.store.dispatch(new ToggleSubPathSelection(source, subIdx));
  }
}
