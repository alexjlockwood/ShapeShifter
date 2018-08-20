import { ActionMode, ActionSource, Hover, Selection } from 'app/modules/editor/model/actionmode';
import { Action } from 'app/modules/editor/store';

export enum ActionModeActionTypes {
  SetActionMode = '__actionmode__SET_ACTION_MODE',
  SetActionModeHover = '__actionmode__SET_ACTION_MODE_HOVER',
  SetActionModeSelections = '__actionmode__SET_ACTION_MODE_SELECTIONS',
  SetPairedSubPaths = '__actionmode__SET_PAIRED_SUBPATHS',
  SetUnpairedSubPath = '__actionmode__SET_UNPAIRED_SUBPATH',
}

export class SetActionMode implements Action {
  readonly type = ActionModeActionTypes.SetActionMode;
  readonly payload: { mode: ActionMode };
  constructor(mode: ActionMode) {
    this.payload = { mode };
  }
}

export class SetActionModeHover implements Action {
  readonly type = ActionModeActionTypes.SetActionModeHover;
  readonly payload: { hover: Hover };
  constructor(hover: Hover) {
    this.payload = { hover };
  }
}

export class SetActionModeSelections implements Action {
  readonly type = ActionModeActionTypes.SetActionModeSelections;
  readonly payload: { selections: ReadonlyArray<Selection> };
  constructor(selections: ReadonlyArray<Selection>) {
    this.payload = { selections };
  }
}

export class SetPairedSubPaths implements Action {
  readonly type = ActionModeActionTypes.SetPairedSubPaths;
  readonly payload: { pairedSubPaths: ReadonlySet<number> };
  constructor(pairedSubPaths: ReadonlySet<number>) {
    this.payload = { pairedSubPaths };
  }
}

export class SetUnpairedSubPath implements Action {
  readonly type = ActionModeActionTypes.SetUnpairedSubPath;
  readonly payload: { unpairedSubPath: { source: ActionSource; subIdx: number } };
  constructor(unpairedSubPath: { source: ActionSource; subIdx: number }) {
    this.payload = { unpairedSubPath };
  }
}

export type ActionModeActions =
  | SetActionMode
  | SetActionModeHover
  | SetActionModeSelections
  | SetPairedSubPaths
  | SetUnpairedSubPath;
