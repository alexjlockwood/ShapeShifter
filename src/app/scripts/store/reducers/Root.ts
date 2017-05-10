import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as animation from '../actions/Animation';
import * as vectorLayer from '../actions/VectorLayer';
import * as fromAnimations from './Animation';
import * as fromVectorLayers from './VectorLayer';

export interface State {
  animations: fromAnimations.State;
  vectorLayers: fromVectorLayers.State;
}

export const initialState: State = {
  animations: fromAnimations.initialState,
  vectorLayers: fromVectorLayers.initialState,
};

type RootActions = animation.Actions | vectorLayer.Actions;

export function reducer(state = initialState, action: RootActions) {
  state = prereduce(state, action);
  state = reduce(state, action);
  state = postreduce(state, action);
  return state;
}

function prereduce(state: State, action: RootActions) {
  // TODO: preprocess state here if necessary
  return state;
}

const reduce: ActionReducer<State> = combineReducers({
  animations: fromAnimations.reducer,
  vectorLayers: fromVectorLayers.reducer,
});

function postreduce(state: State, action: RootActions) {
  // TODO: postprocess state here if necessary
  return state;
}
