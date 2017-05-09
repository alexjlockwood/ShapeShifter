import { Action } from '@ngrx/store';
import { VectorLayer } from '../../layers';

export const ADD_VECTOR_LAYERS = 'ADD_VECTOR_LAYERS';
export const SELECT_LAYER_ID = 'SELECT_LAYER_ID';
export const TOGGLE_LAYER_ID_EXPANSION = 'TOGGLE_LAYER_ID_EXPANSION';
export const TOGGLE_LAYER_ID_VISIBILITY = 'TOGGLE_LAYER_ID_VISIBILITY';

export class AddVectorLayers implements Action {
  readonly type = ADD_VECTOR_LAYERS;
  readonly payload: { vectorLayers: ReadonlyArray<VectorLayer> };
  constructor(vectorLayers: ReadonlyArray<VectorLayer>) {
    this.payload = { vectorLayers };
  }
}

export class SelectLayerId implements Action {
  readonly type = SELECT_LAYER_ID;
  readonly payload: { layerId: string, clearExisting: boolean };
  constructor(layerId: string, clearExisting = true) {
    this.payload = { layerId, clearExisting };
  }
}

export class ToggleLayerIdExpansion implements Action {
  readonly type = TOGGLE_LAYER_ID_EXPANSION;
  readonly payload: { layerId: string, recursive: boolean };
  constructor(layerId: string, recursive = false) {
    this.payload = { layerId, recursive };
  }
}

export class ToggleLayerIdVisibility implements Action {
  readonly type = TOGGLE_LAYER_ID_VISIBILITY;
  readonly payload: { layerId: string };
  constructor(layerId: string) {
    this.payload = { layerId };
  }
}

export type Actions =
  AddVectorLayers
  | SelectLayerId
  | ToggleLayerIdExpansion
  | ToggleLayerIdVisibility;
