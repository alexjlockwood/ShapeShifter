import { Action } from '@ngrx/store';

export const DELETE_SELECTED_MODELS = '__common__DELETE_SELECTED_MODELS';

export class DeleteSelectedModels implements Action {
  readonly type = DELETE_SELECTED_MODELS;
}

export type Actions = DeleteSelectedModels;
