import { ActionReducerMap } from '@ngrx/store';
import { environment } from 'environments/environment';
import { storeFreeze } from 'ngrx-store-freeze';

// TODO: find a way to also add the feature module slices to this state as well?
export interface CoreState {}

export const reducers: ActionReducerMap<CoreState> = {};

const devMetaReducers = [
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  storeFreeze,
];

export const metaReducers = environment.production ? [] : devMetaReducers;
