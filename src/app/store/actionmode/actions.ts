import { CanvasType } from '../..';
import { Path } from '../../scripts/paths';
import { Action } from '@ngrx/store';

export const REVERSE_SELECTED_SUBPATHS = '__actionmode__REVERSE_SELECTED_SUBPATHS';
export const SHIFT_BACK_SELECTED_SUBPATHS = '__actionmode__SHIFT_BACK_SELECTED_SUBPATHS';
export const SHIFT_FORWARD_SELECTED_SUBPATHS = '__actionmode__SHIFT_FORWARD_SELECTED_SUBPATHS';
export const DELETE_SELECTED_SUBPATHS = '__actionmode__DELETE_SELECTED_SUBPATHS';
export const DELETE_SELECTED_SEGMENTS = '__actionmode__DELETE_SELECTED_SEGMENTS';
export const DELETE_SELECTED_POINTS = '__actionmode__DELETE_SELECTED_POINTS';
export const SHIFT_POINT_TO_FRONT = '__actionmode__SHIFT_POINT_TO_FRONT';
export const SPLIT_COMMAND_IN_HALF_HOVER = '__actionmode__SPLIT_COMMAND_IN_HALF_HOVER';
export const SPLIT_COMMAND_IN_HALF_CLICK = '__actionmode__SPLIT_COMMAND_IN_HALF_CLICK';
export const UPDATE_ACTIVE_PATH_BLOCK = '__actionmode__UPDATE_ACTIVE_PATH_BLOCK';

export class ReverseSelectedSubPaths implements Action {
  readonly type = REVERSE_SELECTED_SUBPATHS;
}

export class ShiftBackSelectedSubPaths implements Action {
  readonly type = SHIFT_BACK_SELECTED_SUBPATHS;
}

export class ShiftForwardSelectedSubPaths implements Action {
  readonly type = SHIFT_FORWARD_SELECTED_SUBPATHS;
}

export class DeleteSelectedSubPaths implements Action {
  readonly type = DELETE_SELECTED_SUBPATHS;
}

export class DeleteSelectedSegments implements Action {
  readonly type = DELETE_SELECTED_SEGMENTS;
}

export class DeleteSelectedPoints implements Action {
  readonly type = DELETE_SELECTED_POINTS;
}

export class ShiftPointToFront implements Action {
  readonly type = SHIFT_POINT_TO_FRONT;
}

export class SplitCommandInHalfHover implements Action {
  readonly type = SPLIT_COMMAND_IN_HALF_HOVER;
  readonly payload: { readonly isHovering: boolean };
  constructor(readonly isHovering: boolean) {
    this.payload = { isHovering };
  }
}

export class SplitCommandInHalfClick implements Action {
  readonly type = SPLIT_COMMAND_IN_HALF_CLICK;
}

export class UpdateActivePathBlock implements Action {
  readonly type = UPDATE_ACTIVE_PATH_BLOCK;
  readonly payload: {
    source: CanvasType,
    path: Path,
  };
  constructor(source: CanvasType, path: Path) {
    this.payload = { source, path };
  }
}

export type Actions =
  ReverseSelectedSubPaths
  | ShiftBackSelectedSubPaths
  | ShiftForwardSelectedSubPaths
  | DeleteSelectedSubPaths
  | DeleteSelectedSegments
  | DeleteSelectedPoints
  | ShiftPointToFront
  | SplitCommandInHalfHover
  | SplitCommandInHalfClick
  | UpdateActivePathBlock;
