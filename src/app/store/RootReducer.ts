import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as state from './StateActions';
import * as playback from './PlaybackActions';
import * as fromState from './StateReducer';
import * as fromPlayback from './PlaybackReducer';
import * as actions from './RootActions';

export interface State {
  state: fromState.State;
  playback: fromPlayback.State;
}

export const initialState: State = {
  state: fromState.initialState,
  playback: fromPlayback.initialState,
};

function buildInitialState(): State {
  return {
    state: fromState.buildInitialState(),
    playback: fromPlayback.buildInitialState(),
  };
}

type RootActions =
  actions.NewWorkspace
  | state.Actions
  | playback.Actions;

export function reducer(state = initialState, action: RootActions) {
  switch (action.type) {
    // Add a list of animations to the application state.
    case actions.NEW_WORKSPACE: {
      return buildInitialState();
    }
  }
  return reduce(state, action);
}

const reduce: ActionReducer<State> = combineReducers({
  state: fromState.reducer,
  playback: fromPlayback.reducer,
});
