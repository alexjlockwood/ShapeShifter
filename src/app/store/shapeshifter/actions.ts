import { CanvasType } from '../../CanvasType';
import { AppMode, Hover, Selection } from '.';
import { Action } from '@ngrx/store';

// Shape Shifter actions.
export const ENTER_SHAPE_SHIFTER_MODE = 'ENTER_SHAPE_SHIFTER_MODE';
export const EXIT_SHAPE_SHIFTER_MODE = 'EXIT_SHAPE_SHIFTER_MODE';
export const SET_APP_MODE = 'SET_APP_MODE';
export const SET_HOVER = 'SET_HOVER';
export const SET_SELECTIONS = 'SET_SELECTIONS';
export const TOGGLE_SUBPATH_SELECTION = 'TOGGLE_SUBPATH_SELECTION';
export const TOGGLE_SEGMENT_SELECTIONS = 'TOGGLE_SEGMENT_SELECTION';
export const TOGGLE_POINT_SELECTION = 'TOGGLE_POINT_SELECTION';
export const REVERSE_POINTS = 'REVERSE_POINTS';
export const SHIFT_BACK_POINTS = 'SHIFT_BACK_POINTS';
export const SHIFT_FORWARD_POINTS = 'SHIFT_FORWARD_POINTS';
export const DELETE_SUBPATHS = 'DELETE_SUBPATHS';
export const DELETE_SEGMENTS = 'DELETE_SEGMENTS';
export const DELETE_POINTS = 'DELETE_POINTS';
export const SET_FIRST_POSITION = 'SET_FIRST_POSITION';
export const SPLIT_IN_HALF_HOVER = 'SPLIT_IN_HALF_HOVER';
export const SPLIT_IN_HALF_CLICK = 'SPLIT_IN_HALF_CLICK';

export class EnterShapeShifterMode implements Action {
  readonly type = ENTER_SHAPE_SHIFTER_MODE;
  readonly payload: { blockId: string };
  constructor(readonly blockId: string) {
    this.payload = { blockId };
  }
}

export class ExitShapeShifterMode implements Action {
  readonly type = EXIT_SHAPE_SHIFTER_MODE;
}

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

export class ReversePoints implements Action {
  readonly type = REVERSE_POINTS;
}

export class ShiftBackPoints implements Action {
  readonly type = SHIFT_BACK_POINTS;
}

export class ShiftForwardPoints implements Action {
  readonly type = SHIFT_FORWARD_POINTS;
}

export class DeleteSubPaths implements Action {
  readonly type = DELETE_SUBPATHS;
}

export class DeleteSegments implements Action {
  readonly type = DELETE_SEGMENTS;
}

export class DeletePoints implements Action {
  readonly type = DELETE_POINTS;
}

export class SetFirstPosition implements Action {
  readonly type = SET_FIRST_POSITION;
}

export class SplitInHalfHover implements Action {
  readonly type = SPLIT_IN_HALF_HOVER;
}

export class SplitInHalfClick implements Action {
  readonly type = SPLIT_IN_HALF_CLICK;
}

export type Actions =
  EnterShapeShifterMode
  | ExitShapeShifterMode
  | SetAppMode
  | SetHover
  | SetSelections
  | ToggleSubPathSelection
  | ToggleSegmentSelections
  | TogglePointSelection
  | ReversePoints
  | ShiftBackPoints
  | ShiftForwardPoints
  | DeleteSubPaths
  | DeleteSegments
  | DeletePoints
  | SetFirstPosition
  | SplitInHalfHover
  | SplitInHalfClick;
