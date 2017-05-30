import { environment } from '../../environments/environment';
import * as fromActionMode from './actionmode/reducer';
import * as fromAia from './aia/reducer';
import * as fromPlayback from './playback/reducer';
import * as fromResetable from './resetable/reducer';
import * as fromShapeShifter from './shapeshifter/reducer';
import { compose } from '@ngrx/core/compose'
import {
  Action,
  ActionReducer,
  combineReducers,
} from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { storeLogger } from 'ngrx-store-logger';

export interface State {
  aia: fromAia.State,
  playback: fromPlayback.State,
  shapeshifter: fromShapeShifter.State,
}

const stateReducers = {
  aia: fromAia.reducer,
  playback: fromPlayback.reducer,
  shapeshifter: fromShapeShifter.reducer,
};

const prodMetaReducers = [
  fromResetable.wrapResetable,
  fromActionMode.wrapActionMode,
  combineReducers,
];

const devMetaReducers = [
  storeLogger(),
  storeFreeze,
];

const productionReducer: ActionReducer<State> = compose(...prodMetaReducers)(stateReducers);
const developmentReducer: ActionReducer<State> = compose(...devMetaReducers)(productionReducer);

// Returns the final reducer that is used to initialize the store.
export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
