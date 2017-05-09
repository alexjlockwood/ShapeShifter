import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { storeLogger } from 'ngrx-store-logger';
import { combineReducers } from '@ngrx/store';
import { environment } from '../../../../environments/environment';
import { compose } from '@ngrx/core/compose';
import * as fromRoot from './Root';

export interface State {
  root: fromRoot.State,
}

const reducers = { root: fromRoot.reducer };
const developmentReducer: ActionReducer<State> =
  compose(storeFreeze, combineReducers)(reducers);
const productionReducer: ActionReducer<State> = combineReducers(reducers);

export function reducer(state: any, action: any) {
  if (environment.production) {
    return productionReducer(state, action);
  } else {
    return developmentReducer(state, action);
  }
}

export const getAnimations = (state: State) => state.root.animations.animations;
export const getSelectedAnimationId = (state: State) => state.root.animations.selectedAnimationId;
export const getActiveAnimationId = (state: State) => state.root.animations.activeAnimationId;

export const getVectorLayers = (state: State) => state.root.vectorLayers.vectorLayers;
export const getSelectedLayerIds = (state: State) => state.root.vectorLayers.selectedLayerIds;
export const getCollapsedLayerIds = (state: State) => state.root.vectorLayers.collapsedLayerIds;
export const getHiddenLayerIds = (state: State) => state.root.vectorLayers.hiddenLayerIds;
