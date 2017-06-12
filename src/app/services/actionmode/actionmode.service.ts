import { Injectable } from '@angular/core';
import {
  ActionMode,
  ActionSource,
  Hover,
  HoverType,
  Selection,
} from 'app/scripts/model/actionmode';
import { Path } from 'app/scripts/model/paths';
import {
  State,
  Store,
} from 'app/store';
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
  getActionModeSegmentSelections,
  getActionModeSubPathSelections,
} from 'app/store/actionmode/selectors';
import * as _ from 'lodash';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {

  constructor(private readonly store: Store<State>) { }

  isActionMode() {
    return this.getActionMode() !== ActionMode.None;
  }

  getActionMode() {
    let mode: ActionMode;
    this.store.select(getActionMode).first().subscribe(m => mode = m);
    return mode;
  }

  startActionMode(blockId: string) {
    this.store.dispatch(new StartActionMode(blockId));
  }

  setActionMode(mode: ActionMode) {
    this.store.dispatch(new SetActionMode(mode));
  }

  closeActionMode() {
    const mode = this.getActionMode();
    if (mode === ActionMode.None) {
      return;
    }
    if (mode === ActionMode.Selection) {
      this.store.dispatch(new SetActionMode(ActionMode.None));
    } else {
      this.store.dispatch(new SetActionMode(ActionMode.Selection));
    }
  }

  setSelections(selections: ReadonlyArray<Selection>) {
    this.store.dispatch(new SetActionModeSelections(selections));
  }

  deleteSelections() {
    const mode = this.getActionMode();
    if (mode === ActionMode.Selection) {
      this.store.dispatch(new DeleteActionModeSelections());
    }
  }

  toggleSplitCommandsMode() {
    this.toggleActionMode(ActionMode.SplitCommands);
  }

  toggleSplitSubPathsMode() {
    this.toggleActionMode(ActionMode.SplitSubPaths);
  }

  togglePairSubPathsMode() {
    this.toggleActionMode(ActionMode.PairSubPaths);
  }

  private toggleActionMode(modeToToggle: ActionMode) {
    const currentMode = this.getActionMode();
    if (currentMode === ActionMode.None) {
      return;
    }
    const newMode = currentMode === modeToToggle ? ActionMode.Selection : modeToToggle;
    this.store.dispatch(new SetActionMode(newMode));
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

  isShowingSubPathActionMode() {
    const currentMode = this.getActionMode();
    if (currentMode === ActionMode.None) {
      return false;
    }
    let hasSubPathSelections = false;
    this.store.select(getActionModeSubPathSelections).first().subscribe(selections => {
      hasSubPathSelections = !!selections.length;
    });
    return hasSubPathSelections || currentMode !== ActionMode.Selection;
  }

  isShowingSegmentActionMode() {
    const currentMode = this.getActionMode();
    if (currentMode === ActionMode.None) {
      return false;
    }
    let hasSegmentSelections = false;
    this.store.select(getActionModeSegmentSelections).first().subscribe(selections => {
      hasSegmentSelections = !!selections.length;
    });
    return hasSegmentSelections || currentMode !== ActionMode.Selection;
  }

  isShowingPointActionMode() {
    const currentMode = this.getActionMode();
    if (currentMode === ActionMode.None) {
      return false;
    }
    let hasPointSelections = false;
    this.store.select(getActionModePointSelections).first().subscribe(selections => {
      hasPointSelections = !!selections.length;
    });
    return hasPointSelections || currentMode !== ActionMode.Selection;
  }
}
