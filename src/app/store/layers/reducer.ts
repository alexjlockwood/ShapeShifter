import { VectorLayer } from 'app/model/layers';

import * as actions from './actions';

export interface State {
  readonly vectorLayer: VectorLayer;
  readonly selectedLayerIds: ReadonlySet<string>;
  readonly collapsedLayerIds: ReadonlySet<string>;
  readonly hiddenLayerIds: ReadonlySet<string>;
}

export function buildInitialState() {
  return {
    vectorLayer: new VectorLayer(),
    selectedLayerIds: new Set<string>(),
    collapsedLayerIds: new Set<string>(),
    hiddenLayerIds: new Set<string>(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    case actions.SET_VECTOR_LAYER: {
      return { ...state, vectorLayer: action.payload.vectorLayer };
    }
    case actions.SET_SELECTED_LAYERS: {
      return { ...state, selectedLayerIds: new Set<string>(action.payload.layerIds) };
    }
    case actions.SET_HIDDEN_LAYERS: {
      return { ...state, hiddenLayerIds: new Set<string>(action.payload.layerIds) };
    }
    case actions.SET_COLLAPSED_LAYERS: {
      return { ...state, collapsedLayerIds: new Set<string>(action.payload.layerIds) };
    }
  }
  return state;
}
