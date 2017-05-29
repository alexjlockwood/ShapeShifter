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

const metaReducers = [
  fromResetable.wrapResetable,
  fromActionMode.wrapActionMode,
  combineReducers,
];

const productionReducer: ActionReducer<State> = compose(...metaReducers)(stateReducers);
const developmentReducer: ActionReducer<State> = storeFreeze(productionReducer);

// Returns the final reducer that is used to initialize the store.
export function reducer(state: State, action: Action) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}
