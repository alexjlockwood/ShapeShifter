import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as state from '../actions/Actions';
import * as fromState from './State';

export interface State {
  state: fromState.State;
}

export const initialState: State = {
  state: fromState.initialState,
};

type RootActions = state.Actions;

export function reducer(state = initialState, action: RootActions) {
  return reduce(state, action);
}

const reduce: ActionReducer<State> = combineReducers({
  state: fromState.reducer,
});
