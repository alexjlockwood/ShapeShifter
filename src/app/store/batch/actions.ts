import { Action } from 'app/store/ngrx';

export enum BatchActionTypes {
  BatchAction = '__batchaction__BATCH_ACTION',
}

export class BatchAction implements Action {
  readonly type = BatchActionTypes.BatchAction;
  readonly payload: ReadonlyArray<Action>;
  constructor(...actions: Action[]) {
    this.payload = actions;
  }
}

export type BatchActions = BatchAction;
