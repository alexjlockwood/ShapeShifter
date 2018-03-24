import { Action } from 'app/store/ngrx';

export const BATCH_ACTION = '__batchaction__BATCH_ACTION';

export class BatchAction implements Action {
  readonly type = BATCH_ACTION;
  readonly payload: ReadonlyArray<Action>;
  constructor(...actions: Action[]) {
    this.payload = actions;
  }
}

export type Actions = BatchAction;
