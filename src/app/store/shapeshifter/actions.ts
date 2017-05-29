import { Action } from '@ngrx/store';
import { Hover, Selection, AppMode } from './reducer';
import { CanvasType } from '../../CanvasType';

// Shape Shifter actions.
export const SET_APP_MODE = 'SET_APP_MODE';
export const SET_HOVER = 'SET_HOVER';
export const SET_SELECTIONS = 'SET_SELECTIONS';
export const TOGGLE_SUBPATH_SELECTION = 'TOGGLE_SUBPATH_SELECTION';
export const TOGGLE_SEGMENT_SELECTIONS = 'TOGGLE_SEGMENT_SELECTION';
export const TOGGLE_POINT_SELECTION = 'TOGGLE_POINT_SELECTION';

export class SetAppMode implements Action {
  readonly type = SET_APP_MODE;
  readonly payload: { appMode: AppMode };
  constructor(readonly appMode: AppMode) {
    this.payload = { appMode };
  }
}

export class SetHover implements Action {
  readonly type = SET_HOVER;
  readonly payload: { hover: Hover };
  constructor(readonly hover: Hover) {
    this.payload = { hover };
  }
}

export class SetSelections implements Action {
  readonly type = SET_SELECTIONS;
  readonly payload: { selections: ReadonlyArray<Selection> };
  constructor(readonly selections: ReadonlyArray<Selection>) {
    this.payload = { selections };
  }
}

export class ToggleSubPathSelection implements Action {
  readonly type = TOGGLE_SUBPATH_SELECTION;
  readonly payload: { source: CanvasType, subIdx: number };
  // TODO: support multi-selection for subpaths
  constructor(source: CanvasType, subIdx: number) {
    this.payload = { source, subIdx };
  }
}

export class ToggleSegmentSelections implements Action {
  readonly type = TOGGLE_SEGMENT_SELECTIONS;
  readonly payload: {
    source: CanvasType,
    segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>,
  };
  // TODO: support multi-selection for segments
  constructor(source: CanvasType, segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
    this.payload = { source, segments };
  }
}

export class TogglePointSelection implements Action {
  readonly type = TOGGLE_POINT_SELECTION;
  readonly payload: {
    source: CanvasType,
    subIdx: number,
    cmdIdx: number,
    appendToList: boolean,
  };
  constructor(source: CanvasType, subIdx: number, cmdIdx: number, appendToList = false) {
    this.payload = { source, subIdx, cmdIdx, appendToList };
  }
}

export type Actions =
  SetAppMode
  | SetHover
  | SetSelections
  | ToggleSubPathSelection
  | ToggleSegmentSelections
  | TogglePointSelection;
