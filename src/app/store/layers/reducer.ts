import { VectorLayer } from 'app/model/layers';

import * as actions from './actions';

export interface State {
  readonly vectorLayer: VectorLayer;
  readonly selectedLayerIds: Set<string>;
  readonly hoveredLayerId: string;
  readonly collapsedLayerIds: Set<string>;
  readonly hiddenLayerIds: Set<string>;
}

export function buildInitialState(): State {
  return {
    vectorLayer: new VectorLayer(),
    selectedLayerIds: new Set<string>(),
    hoveredLayerId: undefined as string,
    collapsedLayerIds: new Set<string>(),
    hiddenLayerIds: new Set<string>(),
  };
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    case actions.SET_VECTOR_LAYER:
      return { ...state, vectorLayer: action.payload.vectorLayer };
    case actions.SET_SELECTED_LAYERS:
      return { ...state, selectedLayerIds: new Set<string>(action.payload.layerIds) };
    case actions.SET_HOVERED_LAYERS:
      return { ...state, hoveredLayerId: action.payload.layerId };
    case actions.SET_HIDDEN_LAYERS:
      return { ...state, hiddenLayerIds: new Set<string>(action.payload.layerIds) };
    case actions.SET_COLLAPSED_LAYERS:
      return { ...state, collapsedLayerIds: new Set<string>(action.payload.layerIds) };
  }
  return state;
}
