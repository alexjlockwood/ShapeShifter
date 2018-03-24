import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { Action } from 'app/store/ngrx';

export const RESET_WORKSPACE = '__reset__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
}

export type Actions = ResetWorkspace;
