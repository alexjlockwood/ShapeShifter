import { Action } from '@ngrx/store';
import { ActionSource } from 'app/model/actionmode';
import { Path } from 'app/model/paths';

export const DELETE_ACTION_MODE_SELECTIONS = '__metaactionmode__DELETE_ACTION_MODE_SELECTIONS';
export const AUTO_FIX_CLICK = '__metaactionmode__AUTO_FIX_CLICK';
export const UPDATE_ACTIVE_PATH_BLOCK = '__metaactionmode__UPDATE_ACTIVE_PATH_BLOCK';
export const PAIR_SUBPATH = '__metaactionmode__PAIR_SUBPATH';
export const SET_UNPAIRED_SUBPATH = '__metaactionmode__SET_UNPAIRED_SUBPATH';

export class DeleteActionModeSelections implements Action {
  readonly type = DELETE_ACTION_MODE_SELECTIONS;
}

export class UpdateActivePathBlock implements Action {
  readonly type = UPDATE_ACTIVE_PATH_BLOCK;
  readonly payload: {
    source: ActionSource;
    path: Path;
  };
  constructor(source: ActionSource, path: Path) {
    this.payload = { source, path };
  }
}

export class PairSubPath implements Action {
  readonly type = PAIR_SUBPATH;
  readonly payload: { subIdx: number; source: ActionSource };
  constructor(subIdx: number, source: ActionSource) {
    this.payload = { subIdx, source };
  }
}

export class SetUnpairedSubPath implements Action {
  readonly type = SET_UNPAIRED_SUBPATH;
  readonly payload: { unpairedSubPath: { source: ActionSource; subIdx: number } };
  constructor(unpairedSubPath: { source: ActionSource; subIdx: number }) {
    this.payload = { unpairedSubPath };
  }
}

export type Actions =
  | DeleteActionModeSelections
  | UpdateActivePathBlock
  | PairSubPath
  | SetUnpairedSubPath;
