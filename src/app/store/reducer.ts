import { environment } from '../../environments/environment';
import * as fromActionMode from './actionmode/metareducer';
import * as fromAia from './aia/metareducer';
import * as fromLayers from './layers/reducer';
import * as fromPlayback from './playback/reducer';
import * as fromResetable from './resetable/metareducer';
import * as fromShapeShifter from './shapeshifter/reducer';
import * as fromTimeline from './timeline/reducer';
import { compose } from '@ngrx/core/compose'
import { Action, ActionReducer, combineReducers } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { storeLogger } from 'ngrx-store-logger';

export function logger(reducer) {
  return function newReducer(state, action) {
    const shouldLog = action.type === '__actionmode__SELECT_PAIRED_SUBPATH' || action.type === '__shapeshifter__SET_SHAPE_SHIFTER_HOVER';
    if (shouldLog) {
      console.group(action.type);
    }
    const nextState = reducer(state, action);
    if (shouldLog) {
      console.log(`%c prev state`, `color: #9E9E9E; font-weight: bold`, state);
      console.log(`%c action`, `color: #03A9F4; font-weight: bold`, action);
      console.log(`%c next state`, `color: #4CAF50; font-weight: bold`, nextState);
      console.groupEnd();
    }
    return nextState;
  }
}

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

function reduceReducers(reducers: ReadonlyArray<ActionReducer<State>>) {
  return (state: State, action: Action) => reducers.reduce((s, r) => r(s, action), state);
}

const stateReducers = [
  // Reducer that adds the ability to reset the entire state tree.
  fromResetable.reducer,
  // Reducer that allows us to perform actions that modify different
  // aspects of the state tree while in action mode.
  fromActionMode.reducer,
  // Reducer that adds the ability to modify the layer list and
  // timeline simultaneously.
  fromAia.reducer,
  // Reducer that maps our state reducers to the keys in our state tree.
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

const productionReducer: ActionReducer<State> = reduceReducers(stateReducers);
const developmentReducer: ActionReducer<State> = compose(...devMetaReducers)(productionReducer);

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
