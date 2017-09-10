import { Action } from '@ngrx/store';
import { VectorLayer } from 'app/model/layers';

export const SET_VECTOR_LAYER = '__layers__SET_VECTOR_LAYER';
export const SET_SELECTED_LAYERS = '__layers__SET_SELECTED_LAYERS';
export const SET_HIDDEN_LAYERS = '__layers__SET_HIDDEN_LAYERS';
export const SET_COLLAPSED_LAYERS = '__layers__SET_COLLAPSED_LAYERS';

export class SetVectorLayer implements Action {
  readonly type = SET_VECTOR_LAYER;
  readonly payload: { vectorLayer: VectorLayer };
  constructor(vectorLayer: VectorLayer) {
    this.payload = { vectorLayer };
  }
}

export class SetSelectedLayers implements Action {
  readonly type = SET_SELECTED_LAYERS;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export class SetHiddenLayers implements Action {
  readonly type = SET_HIDDEN_LAYERS;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export class SetCollapsedLayers implements Action {
  readonly type = SET_COLLAPSED_LAYERS;
  readonly payload: { layerIds: ReadonlySet<string> };
  constructor(layerIds: ReadonlySet<string>) {
    this.payload = { layerIds };
  }
}

export type Actions = SetVectorLayer | SetHiddenLayers | SetCollapsedLayers | SetSelectedLayers;
