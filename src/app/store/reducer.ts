import { environment } from '../../environments/environment';
import * as fromActionMode from './actionmode/reducer';
import * as fromLayers from './layers/reducer';
import * as fromPlayback from './playback/reducer';
import * as fromReset from './reset/reducer';
import * as fromShapeShifter from './shapeshifter/reducer';
import * as fromTimeline from './timeline/reducer';
import { compose } from '@ngrx/core/compose'
import { Action, ActionReducer, combineReducers } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { storeLogger } from 'ngrx-store-logger';

export interface State {
  readonly layers: fromLayers.State;
  readonly timeline: fromTimeline.State;
  readonly playback: fromPlayback.State;
  readonly shapeshifter: fromShapeShifter.State;
}

const sliceReducers = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  shapeshifter: fromShapeShifter.reducer,
};

const stateReducers = [
  // Reducer that adds the ability to reset the entire state tree.
  fromReset.reducer,
  // Reducer that allows us to perform actions that modify different
  // aspects of the state tree while in action mode.
  fromActionMode.reducer,
  // Reducer that maps our slice reducers to the keys in our state tree.
  combineReducers(sliceReducers),
];

const devMetaReducers = [
  // Meta reducer that logs the before/after state of the store
  // as actions are performed in dev builds.
  storeLogger(),
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  storeFreeze,
];

// Chains together multiple reducers by executing them sequentially.
function reduceReducers(reducers: ReadonlyArray<ActionReducer<State>>) {
  return (state: State, action: Action) => reducers.reduce((s, r) => r(s, action), state);
}

const productionReducer: ActionReducer<State> = reduceReducers(stateReducers);
const developmentReducer: ActionReducer<State> = compose(...devMetaReducers)(productionReducer);

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
