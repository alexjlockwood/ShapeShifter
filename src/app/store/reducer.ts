import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as actions from './actions';
import * as aia from './aia/actions';
import * as playback from './playback/actions';
import * as shapeshifter from './shapeshifter/actions';
import * as fromAia from './aia/reducer';
import * as fromPlayback from './playback/reducer';
import * as fromShapeShifter from './shapeshifter/reducer';

export interface State {
  aia: fromAia.State;
  playback: fromPlayback.State;
  shapeshifter: fromShapeShifter.State;
}

export const initialState: State = {
  aia: fromAia.initialState,
  playback: fromPlayback.initialState,
  shapeshifter: fromShapeShifter.initialState,
};

function buildInitialState(): State {
  return {
    aia: fromAia.buildInitialState(),
    playback: fromPlayback.buildInitialState(),
    shapeshifter: fromShapeShifter.buildInitialState(),
  };
}

type RootActions =
  actions.NewWorkspace
  | aia.Actions
  | playback.Actions
  | shapeshifter.Actions;

export function reducer(state = initialState, action: RootActions) {
  switch (action.type) {
    case actions.NEW_WORKSPACE: {
      return buildInitialState();
    }
  }
  return reduce(state, action);
}

const reduce: ActionReducer<State> = combineReducers({
  aia: fromAia.reducer,
  playback: fromPlayback.reducer,
  shapeshifter: fromShapeShifter.reducer,
});
