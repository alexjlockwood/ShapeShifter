import { Action } from '@ngrx/store';

export const CLEAR_SELECTIONS = '__common__CLEAR_SELECTIONS';
export const DELETE_SELECTED_MODELS = '__common__DELETE_SELECTED_MODELS';

export class ClearSelections implements Action {
  readonly type = CLEAR_SELECTIONS;
}

export class DeleteSelectedModels implements Action {
  readonly type = DELETE_SELECTED_MODELS;
}

export type Actions = ClearSelections | DeleteSelectedModels;
