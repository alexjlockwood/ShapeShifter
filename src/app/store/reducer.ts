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

export interface State {
  readonly layers: fromLayers.State;
  readonly timeline: fromTimeline.State;
  readonly playback: fromPlayback.State;
  readonly shapeshifter: fromShapeShifter.State;
}

const stateReducers = {
  layers: fromLayers.reducer,
  timeline: fromTimeline.reducer,
  playback: fromPlayback.reducer,
  shapeshifter: fromShapeShifter.reducer,
};

const prodMetaReducers = [
  // Meta reducer that adds the ability to reset the entire state tree.
  fromResetable.metaReducer,
  // Meta reducer that allows us to perform actions that modify different
  // aspects of the state tree while in action mode.
  fromActionMode.metaReducer,
  // Meta reducer that adds the ability to modify the layer list and
  // timeline simultaneously.
  fromAia.metaReducer,
  // Meta reducer that maps our state reducers to the keys in our state tree.
  combineReducers,
];

const devMetaReducers = [
  // Meta reducer that logs the before/after state of the store
  // as actions are performed in dev builds.
  storeLogger(),
  // Meta reducer that freezes the state tree to ensure that
  // accidental mutations fail fast in dev builds.
  storeFreeze,
];

const productionReducer: ActionReducer<State> = compose(...prodMetaReducers)(stateReducers);
const developmentReducer: ActionReducer<State> = compose(...devMetaReducers)(productionReducer);

export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
