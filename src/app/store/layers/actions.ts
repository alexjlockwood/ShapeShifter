import { Layer } from '../../scripts/layers';
import { Action } from '@ngrx/store';

// Layer actions.
export const ADD_LAYERS = '__layers__ADD_LAYERS';
export const CLEAR_LAYER_SELECTIONS = '__layers__CLEAR_LAYER_SELECTIONS';
export const TOGGLE_LAYER_EXPANSION = '__layers__TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = '__layers__TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = '__layers__REPLACE_LAYER';

export class AddLayers implements Action {
  readonly type = ADD_LAYERS;
  readonly payload: { layers: ReadonlyArray<Layer> };
  constructor(layers: ReadonlyArray<Layer>) {
    this.payload = { layers };
  }
}

export class ClearLayerSelections implements Action {
  readonly type = CLEAR_LAYER_SELECTIONS;
}

export class ToggleLayerExpansion implements Action {
  readonly type = TOGGLE_LAYER_EXPANSION;
  readonly payload: { layerId: string, recursive: boolean };
  constructor(layerId: string, recursive = false) {
    this.payload = { layerId, recursive };
  }
}

export class ToggleLayerVisibility implements Action {
  readonly type = TOGGLE_LAYER_VISIBILITY;
  readonly payload: { layerId: string };
  constructor(layerId: string) {
    this.payload = { layerId };
  }
}

// TODO: change this to 'replace layers' (plural)
export class ReplaceLayer implements Action {
  readonly type = REPLACE_LAYER;
  readonly payload: { layer: Layer };
  constructor(layer: Layer) {
    this.payload = { layer, };
  }
}

export type Actions =
  AddLayers
  | ClearLayerSelections
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | ReplaceLayer;
