import { Action } from '@ngrx/store';
import {
  ActionMode,
  ActionSource,
  Hover,
  Selection,
} from 'app/scripts/model/actionmode';

export const START_ACTION_MODE = '__actionmode__START_ACTION_MODE';
export const SET_ACTION_MODE = '__actionmode__SET_ACTION_MODE';
export const SET_ACTION_MODE_HOVER = '__actionmode__SET_ACTION_MODE_HOVER';
export const SET_ACTION_MODE_SELECTIONS = '__actionmode__SET_ACTION_MODE_SELECTIONS';
export const TOGGLE_SUBPATH_SELECTION = '__actionmode__TOGGLE_SUBPATH_SELECTION';
export const TOGGLE_SEGMENT_SELECTIONS = '__actionmode__TOGGLE_SEGMENT_SELECTION';
export const TOGGLE_POINT_SELECTION = '__actionmode__TOGGLE_POINT_SELECTION';

export class StartActionMode implements Action {
  readonly type = START_ACTION_MODE;
  readonly payload: { blockId: string };
  constructor(readonly blockId: string) {
    this.payload = { blockId };
  }
}

export class SetActionMode implements Action {
  readonly type = SET_ACTION_MODE;
  readonly payload: { mode: ActionMode };
  constructor(mode: ActionMode) {
    this.payload = { mode };
  }
}

export class SetActionModeHover implements Action {
  readonly type = SET_ACTION_MODE_HOVER;
  readonly payload: { hover: Hover };
  constructor(hover: Hover) {
    this.payload = { hover };
  }
}

export class SetActionModeSelections implements Action {
  readonly type = SET_ACTION_MODE_SELECTIONS;
  readonly payload: { selections: ReadonlyArray<Selection> };
  constructor(selections: ReadonlyArray<Selection>) {
    this.payload = { selections };
  }
}

export class ToggleSubPathSelection implements Action {
  readonly type = TOGGLE_SUBPATH_SELECTION;
  readonly payload: { source: ActionSource, subIdx: number };
  // TODO: support multi-selection for subpaths
  constructor(source: ActionSource, subIdx: number) {
    this.payload = { source, subIdx };
  }
}

export class ToggleSegmentSelections implements Action {
  readonly type = TOGGLE_SEGMENT_SELECTIONS;
  readonly payload: {
    source: ActionSource,
    segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>,
  };
  // TODO: support multi-selection for segments
  constructor(source: ActionSource, segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
    this.payload = { source, segments };
  }
}

export class TogglePointSelection implements Action {
  readonly type = TOGGLE_POINT_SELECTION;
  readonly payload: {
    source: ActionSource,
    subIdx: number,
    cmdIdx: number,
    appendToList: boolean,
  };
  constructor(
    source: ActionSource,
    subIdx: number,
    cmdIdx: number,
    appendToList = false,
  ) {
    this.payload = { source, subIdx, cmdIdx, appendToList };
  }
}

export type Actions =
  StartActionMode
  | SetActionMode
  | SetActionModeHover
  | SetActionModeSelections
  | ToggleSubPathSelection
  | ToggleSegmentSelections
  | TogglePointSelection;
