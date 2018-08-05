import { VectorLayer } from 'app/modules/editor/model/layers';

import { LayerActionTypes, LayerActions } from './actions';

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

export function reducer(state = buildInitialState(), action: LayerActions) {
  switch (action.type) {
    case LayerActionTypes.SetVectorLayer:
      return { ...state, vectorLayer: action.payload.vectorLayer };
    case LayerActionTypes.SetSelectedLayers:
      return { ...state, selectedLayerIds: new Set<string>(action.payload.layerIds) };
    case LayerActionTypes.SetHiddenLayers:
      return { ...state, hiddenLayerIds: new Set<string>(action.payload.layerIds) };
    case LayerActionTypes.SetCollapsedLayers:
      return { ...state, collapsedLayerIds: new Set<string>(action.payload.layerIds) };
  }
  return state;
}
