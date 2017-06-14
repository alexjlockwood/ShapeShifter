import {
  ClearSelections,
  DeleteSelectedModels,
} from '../common/actions';
import {
  AddBlock,
  SelectAnimation,
  SelectBlock,
} from '../timeline/actions';
import { Action } from '@ngrx/store';
import {
  Layer,
  VectorLayer,
} from 'app/scripts/model/layers';

export const IMPORT_VECTOR_LAYERS = '__layers__IMPORT_VECTOR_LAYERS';
export const ADD_LAYER = '__layers__ADD_LAYER';
export const TOGGLE_LAYER_EXPANSION = '__layers__TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = '__layers__TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = '__layers__REPLACE_LAYER';
export const SELECT_LAYER = '__layers__SELECT_LAYER';
export const GROUP_OR_UNGROUP_SELECTED_LAYERS = '__layers__GROUP_OR_UNGROUP_SELECTED_LAYERS';
export { SELECT_ANIMATION, ADD_BLOCK, SELECT_BLOCK } from '../timeline/actions';
export { CLEAR_SELECTIONS, DELETE_SELECTED_MODELS } from '../common/actions';

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
    this.payload = { layer };
  }
}

export class SelectLayer implements Action {
  readonly type = SELECT_LAYER;
  readonly payload: { layerId: string, clearExisting: boolean };
  constructor(layerId: string, clearExisting: boolean) {
    this.payload = { layerId, clearExisting };
  }
}

export class GroupOrUngroupSelectedLayers implements Action {
  readonly type = GROUP_OR_UNGROUP_SELECTED_LAYERS;
  readonly payload: { shouldGroup: boolean };
  constructor(shouldGroup: boolean) {
    this.payload = { shouldGroup };
  }
}

export type Actions =
  ImportVectorLayers
  | AddLayer
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | ReplaceLayer
  | SelectLayer
  | GroupOrUngroupSelectedLayers
  | SelectAnimation
  | SelectBlock
  | AddBlock
  | ClearSelections
  | DeleteSelectedModels;
