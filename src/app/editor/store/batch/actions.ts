import { Action } from 'app/editor/store';

export enum BatchActionTypes {
  BatchAction = '__batch__BATCH',
}

export class BatchAction implements Action {
  readonly type = BatchActionTypes.BatchAction;
  readonly payload: ReadonlyArray<Action>;
  constructor(...actions: Action[]) {
    this.payload = actions;
  }
}

export type BatchActions = BatchAction;
