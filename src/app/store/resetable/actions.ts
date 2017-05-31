import { Action } from '@ngrx/store';

export const RESET_WORKSPACE = '__resetable__RESET_WORKSPACE';

export class ResetWorkspace implements Action {
  readonly type = RESET_WORKSPACE;
}

export type Actions = ResetWorkspace;
