import { Action } from '@ngrx/store';

export const MULTI_ACTION = '__multiaction__MULTI_ACTION';

export class MultiAction implements Action {
  readonly type = MULTI_ACTION;
  readonly payload: ReadonlyArray<Action>;
  constructor(...actions: Action[]) {
    this.payload = actions;
  }
}

export type Actions = MultiAction;
