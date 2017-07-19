import { compose } from '@ngrx/core/compose';
import { Action, ActionReducer, combineReducers } from '@ngrx/store';
import { environment } from 'environments/environment';
import { storeLogger } from 'ngrx-store-logger';

import * as fromActionMode from './actionmode/reducer';
import * as fromLayers from './layers/reducer';
import * as metaMultiAction from './multiaction/metareducer';
import * as fromPlayback from './playback/reducer';
import * as metaReset from './reset/metareducer';
import * as fromReset from './reset/reducer';
import * as metaStoreFreeze from './storefreeze/metareducer';
import * as fromTheme from './theme/reducer';
import * as fromTimeline from './timeline/reducer';
import * as metaUndoRedo from './undoredo/metareducer';

export type State = metaUndoRedo.StateWithHistoryAndTimestamp;

export interface AppState {
  readonly layers: fromLayers.State;
  readonly timeline: fromTimeline.State;
  readonly playback: fromPlayback.State;
  readonly actionmode: fromActionMode.State;
  readonly reset: fromReset.State;
  readonly theme: fromTheme.State;
}

const sliceReducers = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  actionmode: fromActionMode.reducer,
  reset: fromReset.reducer,
  theme: fromTheme.reducer,
};

const prodMetaReducers = [
  // Meta-reducer that records past/present/future state.
  metaUndoRedo.metaReducer,
  // Meta-reducer that adds the ability to dispatch multiple actions at a time.
  metaMultiAction.metaReducer,
  // Meta-reducer that adds the ability to reset the entire state tree.
  metaReset.metaReducer,
  // Meta-reducer that maps our slice reducers to the keys in our state tree.
  combineReducers,
];

const devMetaReducers = [
  // Meta reducer that logs the before/after state of the store
  // as actions are performed in dev builds.
  storeLogger({ collapsed: true }),
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  metaStoreFreeze.metaReducer,
];

export const prodReducer = compose(...prodMetaReducers)(sliceReducers) as ActionReducer<State>;
const devReducer = compose(...devMetaReducers)(prodReducer) as ActionReducer<State>;

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return prodReducer(state, action);
  } else {
    return devReducer(state, action);
  }
}
