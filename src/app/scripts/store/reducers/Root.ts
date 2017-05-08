import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { combineReducers } from '@ngrx/store';
import * as animation from '../actions/Animation';
import * as vectorLayer from '../actions/VectorLayer';
import * as fromAnimations from './Animation';
import * as fromVectorLayers from './VectorLayer';

export interface State {
  animations: fromAnimations.State,
  vectorLayers: fromVectorLayers.State,
};

export const initialState: State = {
  animations: fromAnimations.initialState,
  vectorLayers: fromVectorLayers.initialState,
};

type RootActions = animation.Actions | vectorLayer.Actions;

function prereducer(state: State, action: RootActions) {
  // TODO: preprocess state here if necessary
  return state;
}

const rootReducer: ActionReducer<State> = combineReducers({
  animations: fromAnimations.reducer,
  vectorLayers: fromVectorLayers.reducer,
});

function postreducer(state: State, action: RootActions) {
  // TODO: postprocess state here if necessary
  return state;
}

export function reducer(state = initialState, action: RootActions) {
  state = prereducer(state, action);
  console.info('before', state);
  state = rootReducer(state, action);
  console.info('middle', state);
  state = postreducer(state, action);
  console.info('after', state);
  return state;
}
