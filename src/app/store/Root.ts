import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as state from './StateActions';
import * as playback from './PlaybackActions';
import * as fromState from './StateReducer';
import * as fromPlayback from './PlaybackReducer';

export interface State {
  state: fromState.State;
  playback: fromPlayback.State;
}

export const initialState: State = {
  state: fromState.initialState,
  playback: fromPlayback.initialState,
};

type RootActions = state.Actions | playback.Actions;

export function reducer(state = initialState, action: RootActions) {
  return reduce(state, action);
}

const reduce: ActionReducer<State> = combineReducers({
  state: fromState.reducer,
  playback: fromPlayback.reducer,
});
