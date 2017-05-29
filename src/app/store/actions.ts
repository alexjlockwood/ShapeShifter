import { Action } from '@ngrx/store';

// Shared actions.
export const NEW_WORKSPACE = 'NEW_WORKSPACE';

export class NewWorkspace implements Action {
  readonly type = NEW_WORKSPACE;
}

export type Actions = NewWorkspace;
