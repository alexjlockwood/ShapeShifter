import { ActionReducerMap } from '@ngrx/store';
import { environment } from 'environments/environment';
import { storeFreeze } from 'ngrx-store-freeze';

import * as fromAuth from './auth/auth.reducer';
import * as fromProjects from './projects/projects.reducer';

// TODO: add the editor feature slice to this state as well
export interface AppState {
  readonly auth: fromAuth.State;
  readonly projects: fromProjects.State;
}

export const reducers: ActionReducerMap<AppState> = {
  auth: fromAuth.reducer,
  projects: fromProjects.reducer,
};

const devMetaReducers = [
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  storeFreeze,
];

export const metaReducers = environment.production ? [] : devMetaReducers;
