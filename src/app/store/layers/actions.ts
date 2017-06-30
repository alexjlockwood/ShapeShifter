import { Action } from '@ngrx/store';
import { Layer } from 'app/scripts/model/layers';

export const REPLACE_LAYER = '__layers__REPLACE_LAYER';
export const SET_SELECTED_LAYERS = '__layers__SET_SELECTED_LAYERS';
export const SET_HIDDEN_LAYERS = '__layers__SET_HIDDEN_LAYERS';
export const SET_COLLAPSED_LAYERS = '__layers__SET_COLLAPSED_LAYERS';

// TODO: change this to 'replace layers' (plural)
export class ReplaceLayer implements Action {
  readonly type = REPLACE_LAYER;
  readonly payload: { layer: Layer };
  constructor(layer: Layer) {
    this.payload = { layer };
  }
}

export class SetSelectedLayers implements Action {
  readonly type = SET_SELECTED_LAYERS;
  readonly payload: { layerIds: Set<string> };
  constructor(layerIds: Set<string>) {
    this.payload = { layerIds };
  }
}

export class SetHiddenLayers implements Action {
  readonly type = SET_HIDDEN_LAYERS;
  readonly payload: { layerIds: Set<string> };
  constructor(layerIds: Set<string>) {
    this.payload = { layerIds };
  }
}

export class SetCollapsedLayers implements Action {
  readonly type = SET_COLLAPSED_LAYERS;
  readonly payload: { layerIds: Set<string> };
  constructor(layerIds: Set<string>) {
    this.payload = { layerIds };
  }
}

export type Actions = ReplaceLayer | SetHiddenLayers | SetCollapsedLayers | SetSelectedLayers;
