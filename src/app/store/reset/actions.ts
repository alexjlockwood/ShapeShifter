import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { Action } from 'app/store/ngrx';

export enum ResetActionTypes {
  ResetWorkspace = '__reset__RESET_WORKSPACE',
}

export class ResetWorkspace implements Action {
  readonly type = ResetActionTypes.ResetWorkspace;
}

export type ResetActions = ResetWorkspace;
