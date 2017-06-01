import { Layer } from '../../scripts/layers';
import { DeleteSelectedModels } from '../aia/actions';
import { SelectAnimation, SelectBlock } from '../timeline/actions';
import { Action } from '@ngrx/store';

export const ADD_LAYERS = '__layers__ADD_LAYERS';
export const CLEAR_LAYER_SELECTIONS = '__layers__CLEAR_LAYER_SELECTIONS';
export const TOGGLE_LAYER_EXPANSION = '__layers__TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = '__layers__TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = '__layers__REPLACE_LAYER';
export const SELECT_LAYER = '__layers__SELECT_LAYER';
export { SELECT_ANIMATION, SELECT_BLOCK } from '../timeline/actions';
export { DELETE_SELECTED_MODELS } from '../aia/actions';

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

export class SelectLayer implements Action {
  readonly type = SELECT_LAYER;
  readonly payload: { layerId: string, shouldToggle: boolean, clearExisting: boolean };
  constructor(layerId: string, shouldToggle: boolean, clearExisting: boolean) {
    this.payload = { layerId, shouldToggle, clearExisting };
  }
}

export type Actions =
  AddLayers
  | ClearLayerSelections
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | ReplaceLayer
  | SelectLayer
  | SelectAnimation
  | SelectBlock
  | DeleteSelectedModels;
