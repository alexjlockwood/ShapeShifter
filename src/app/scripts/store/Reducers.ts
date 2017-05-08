import {
  AddAnimations, ADD_ANIMATIONS,
  AddVectorLayers, ADD_VECTOR_LAYERS,
  ToggleLayerIdSelection, TOGGLE_LAYER_ID_SELECTION,
} from './Actions';
import { ActionReducer } from '@ngrx/store';
import { Animation } from '../animations';
import { VectorLayer } from '../layers';

export const REDUCERS = {
  animations: animationsReducer,
  vectorLayers: vectorLayersReducer,
  selectedLayerIds: selectedLayerIdsReducer,
};

export type AnimationState = ReadonlyArray<Animation>;
export type VectorLayerState = ReadonlyArray<VectorLayer>;
export type SelectedLayerIdsState = Set<string>;

export interface AppState {
  /** The list of user-created animations. */
  animations: AnimationState;
  /** The list of user-imported vector layers. */
  vectorLayers: VectorLayerState;
  /** The list of user-selected layer IDs. */
  selectedLayerIds: SelectedLayerIdsState;
}

export function animationsReducer(
  state: AnimationState = [],
  action: AddAnimations,
) {
  switch (action.type) {
    case ADD_ANIMATIONS:
      return state.concat(...action.payload);
  }
  return state;
}

export function vectorLayersReducer(
  state: VectorLayerState = [],
  action: AddVectorLayers,
) {
  switch (action.type) {
    case ADD_VECTOR_LAYERS:
      return state.concat(...action.payload);
  }
  return state;
}

export function selectedLayerIdsReducer(
  state: SelectedLayerIdsState = new Set(),
  action: ToggleLayerIdSelection,
) {
  switch (action.type) {
    case TOGGLE_LAYER_ID_SELECTION:
      const { type, payload: { layerId, clearExistingSelections } } = action;
      // TODO: implement this
      return state;
  }
  return state;
}
