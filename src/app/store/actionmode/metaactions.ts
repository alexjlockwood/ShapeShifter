import { Path } from '../../scripts/paths';
import { ActionSource } from './types';
import { Action } from '@ngrx/store';

export const REVERSE_SELECTED_SUBPATHS = '__metaactionmode__REVERSE_SELECTED_SUBPATHS';
export const SHIFT_BACK_SELECTED_SUBPATHS = '__metaactionmode__SHIFT_BACK_SELECTED_SUBPATHS';
export const SHIFT_FORWARD_SELECTED_SUBPATHS = '__metaactionmode__SHIFT_FORWARD_SELECTED_SUBPATHS';
export const DELETE_ACTION_SELECTIONS = '__metaactionmode__DELETE_ACTION_SELECTIONS';
export const SHIFT_POINT_TO_FRONT = '__metaactionmode__SHIFT_POINT_TO_FRONT';
export const SPLIT_COMMAND_IN_HALF_HOVER = '__metaactionmode__SPLIT_COMMAND_IN_HALF_HOVER';
export const SPLIT_COMMAND_IN_HALF_CLICK = '__metaactionmode__SPLIT_COMMAND_IN_HALF_CLICK';
export const AUTO_FIX_CLICK = '__metaactionmode__AUTO_FIX_CLICK';
export const UPDATE_ACTIVE_PATH_BLOCK = '__metaactionmode__UPDATE_ACTIVE_PATH_BLOCK';
export const PAIR_SUBPATH = '__metaactionmode__PAIR_SUBPATH';
export const SET_UNPAIRED_SUBPATH = '__metaactionmode__SET_UNPAIRED_SUBPATH';

export class ReverseSelectedSubPaths implements Action {
  readonly type = REVERSE_SELECTED_SUBPATHS;
}

export class ShiftBackSelectedSubPaths implements Action {
  readonly type = SHIFT_BACK_SELECTED_SUBPATHS;
}

export class ShiftForwardSelectedSubPaths implements Action {
  readonly type = SHIFT_FORWARD_SELECTED_SUBPATHS;
}

export class DeleteActionSelections implements Action {
  readonly type = DELETE_ACTION_SELECTIONS;
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

export class AutoFixClick implements Action {
  readonly type = AUTO_FIX_CLICK;
}

export class UpdateActivePathBlock implements Action {
  readonly type = UPDATE_ACTIVE_PATH_BLOCK;
  readonly payload: {
    source: ActionSource,
    path: Path,
  };
  constructor(source: ActionSource, path: Path) {
    this.payload = { source, path };
  }
}

export class PairSubPath implements Action {
  readonly type = PAIR_SUBPATH;
  readonly payload: { subIdx: number, source: ActionSource; };
  constructor(subIdx: number, source: ActionSource) {
    this.payload = { subIdx, source };
  }
}

export class SetUnpairedSubPath implements Action {
  readonly type = SET_UNPAIRED_SUBPATH;
  readonly payload: { unpairedSubPath: { source: ActionSource, subIdx: number } };
  constructor(unpairedSubPath: { source: ActionSource, subIdx: number }) {
    this.payload = { unpairedSubPath };
  }
}

export type Actions =
  ReverseSelectedSubPaths
  | ShiftBackSelectedSubPaths
  | ShiftForwardSelectedSubPaths
  | DeleteActionSelections
  | ShiftPointToFront
  | SplitCommandInHalfHover
  | SplitCommandInHalfClick
  | AutoFixClick
  | UpdateActivePathBlock
  | PairSubPath
  | SetUnpairedSubPath;
