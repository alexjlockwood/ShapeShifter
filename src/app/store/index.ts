import { createSelector } from 'reselect';
import { ActionReducer } from '@ngrx/store';
import { storeFreeze } from 'ngrx-store-freeze';
import { combineReducers } from '@ngrx/store';
import { environment } from '../../environments/environment';
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

export const getAnimations = (state: State) => state.root.state.animations;
export const getSelectedAnimationIds = (state: State) => state.root.state.selectedAnimationIds;
export const getActiveAnimationId = (state: State) => state.root.state.activeAnimationId;
export const getSelectedBlockIds = (state: State) => state.root.state.selectedBlockIds;

export const getVectorLayers = (state: State) => state.root.state.vectorLayers;
export const getSelectedLayerIds = (state: State) => state.root.state.selectedLayerIds;
export const getCollapsedLayerIds = (state: State) => state.root.state.collapsedLayerIds;
export const getHiddenLayerIds = (state: State) => state.root.state.hiddenLayerIds;

export {
  AddAnimations,
  SelectAnimationId,
  ActivateAnimationId,
  ReplaceAnimations,
  AddBlock,
  SelectBlockId,
  ReplaceBlocks,
  AddVectorLayers,
  ReplaceVectorLayer,
  SelectLayerId,
  ToggleLayerIdExpansion,
  ToggleLayerIdVisibility,
  AddLayer,
} from './Actions';
