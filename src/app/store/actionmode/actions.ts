import { Action } from '@ngrx/store';
import { ActionMode, Hover, Selection } from 'app/model/actionmode';

export const SET_ACTION_MODE = '__actionmode__SET_ACTION_MODE';
export const SET_ACTION_MODE_HOVER = '__actionmode__SET_ACTION_MODE_HOVER';
export const SET_ACTION_MODE_SELECTIONS = '__actionmode__SET_ACTION_MODE_SELECTIONS';

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

export type Actions = SetActionMode | SetActionModeHover | SetActionModeSelections;
