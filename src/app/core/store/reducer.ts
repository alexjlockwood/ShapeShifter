import { environment } from 'environments/environment';
import { storeFreeze } from 'ngrx-store-freeze';

export const reducers = {};

const devMetaReducers = [
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  storeFreeze,
];

export const metaReducers = environment.production ? [] : devMetaReducers;
