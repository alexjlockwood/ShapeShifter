import { Action } from '@ngrx/store';
import { Layer, VectorLayer } from 'app/scripts/model/layers';

import { DeleteSelectedModels } from '../common/actions';
import { AddBlock } from '../timeline/actions';

export const IMPORT_VECTOR_LAYERS = '__layers__IMPORT_VECTOR_LAYERS';
export const ADD_LAYER = '__layers__ADD_LAYER';
export const TOGGLE_LAYER_EXPANSION = '__layers__TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = '__layers__TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = '__layers__REPLACE_LAYER';
export const GROUP_OR_UNGROUP_SELECTED_LAYERS = '__layers__GROUP_OR_UNGROUP_SELECTED_LAYERS';
export const SET_SELECTED_LAYERS = '__layers__SET_SELECTED_LAYERS';
export { ADD_BLOCK } from '../timeline/actions';
export { DELETE_SELECTED_MODELS } from '../common/actions';

export class ImportVectorLayers implements Action {
  readonly type = IMPORT_VECTOR_LAYERS;
  readonly payload: { vectorLayers: ReadonlyArray<VectorLayer> };
  constructor(vectorLayers: ReadonlyArray<VectorLayer>) {
    this.payload = { vectorLayers };
  }
}

export class AddLayer implements Action {
  readonly type = ADD_LAYER;
  readonly payload: { layer: Layer };
  constructor(layer: Layer) {
    this.payload = { layer };
  }
}

export class ToggleLayerExpansion implements Action {
  readonly type = TOGGLE_LAYER_EXPANSION;
  readonly payload: { layerId: string; recursive: boolean };
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
    this.payload = { layer };
  }
}

export class GroupOrUngroupSelectedLayers implements Action {
  readonly type = GROUP_OR_UNGROUP_SELECTED_LAYERS;
  readonly payload: { shouldGroup: boolean };
  constructor(shouldGroup: boolean) {
    this.payload = { shouldGroup };
  }
}

export class SetSelectedLayers implements Action {
  readonly type = SET_SELECTED_LAYERS;
  readonly payload: { layerIds: Set<string> };
  constructor(layerIds: Set<string>) {
    this.payload = { layerIds };
  }
}

export type Actions =
  | ImportVectorLayers
  | AddLayer
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | ReplaceLayer
  | GroupOrUngroupSelectedLayers
  | AddBlock
  | DeleteSelectedModels
  | SetSelectedLayers;
