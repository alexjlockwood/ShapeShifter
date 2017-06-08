import { environment } from '../../environments/environment';
import * as metaActionMode from './actionmode/metareducer';
import * as fromActionMode from './actionmode/reducer';
import * as fromLayers from './layers/reducer';
import * as fromPlayback from './playback/reducer';
import * as metaReset from './reset/metareducer';
import * as metaStoreFreeze from './storefreeze/metareducer';
import * as fromTimeline from './timeline/reducer';
import { compose } from '@ngrx/core/compose';
import { Action, ActionReducer, combineReducers } from '@ngrx/store';
import { storeLogger } from 'ngrx-store-logger';
import undoable from 'redux-undo';
import { StateWithHistory } from 'redux-undo';

export interface AppState {
  readonly layers: fromLayers.State;
  readonly timeline: fromTimeline.State;
  readonly playback: fromPlayback.State;
  readonly actionmode: fromActionMode.State;
}

export type State = StateWithHistory<AppState>;

const sliceReducers = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  actionmode: fromActionMode.reducer,
};

function undoableMetaReducer(reducer: ActionReducer<State>) {
  return undoable(reducer, {
    limit: 100,
  });
}

const prodMetaReducers = [
  // Meta-reducer that records past/present/future state.
  undoableMetaReducer,
  // Meta-reducer that adds the ability to reset the entire state tree.
  metaReset.metaReducer,
  // Meta-reducer that allows us to perform actions that modify different
  // aspects of the state tree while in action mode.
  metaActionMode.metaReducer,
  // Meta-reducer that maps our slice reducers to the keys in our state tree.
  combineReducers,
];

const devMetaReducers = [
  // Meta reducer that logs the before/after state of the store
  // as actions are performed in dev builds.
  storeLogger(),
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  metaStoreFreeze.metaReducer,
];

const productionReducer: ActionReducer<State> = compose(...prodMetaReducers)(sliceReducers);
const developmentReducer: ActionReducer<State> = compose(...devMetaReducers)(productionReducer);

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
