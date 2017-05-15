import { Action } from '@ngrx/store';
import { Animation, AnimationBlock } from '../scripts/animations';
import { Layer } from '../scripts/layers';

// Animation actions.
export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION = 'SELECT_ANIMATION';
export const ACTIVATE_ANIMATION = 'ACTIVATE_ANIMATION_ID';
export const REPLACE_ANIMATIONS = 'REPLACE_ANIMATIONS';
export const ADD_BLOCK = 'ADD_BLOCK';
export const SELECT_BLOCK = 'SELECT_BLOCK_ID';
export const REPLACE_BLOCKS = 'REPLACE_BLOCKS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(readonly animations: ReadonlyArray<Animation>) {
    this.payload = { animations };
  }
}

export class SelectAnimation implements Action {
  readonly type = SELECT_ANIMATION;
  readonly payload: { animationId: string, clearExisting: boolean };
  constructor(readonly animationId: string, readonly clearExisting = false) {
    this.payload = { animationId, clearExisting };
  }
}

export class ActivateAnimation implements Action {
  readonly type = ACTIVATE_ANIMATION;
  readonly payload: { animationId: string };
  constructor(readonly animationId: string) {
    this.payload = { animationId };
  }
}

export class ReplaceAnimations implements Action {
  readonly type = REPLACE_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(readonly animations: ReadonlyArray<Animation>) {
    this.payload = { animations };
  }
}

export class AddBlock implements Action {
  readonly type = ADD_BLOCK;
  readonly payload: { layer: Layer, propertyName: string, fromValue: any, toValue: any };
  constructor(
    readonly layer: Layer,
    readonly propertyName: string,
    readonly fromValue: any,
    readonly toValue: any,
  ) {
    this.payload = { layer, propertyName, fromValue, toValue };
  }
}

export class SelectBlock implements Action {
  readonly type = SELECT_BLOCK;
  readonly payload: { blockId: string, clearExisting: boolean };
  constructor(readonly blockId: string, readonly clearExisting = true) {
    this.payload = { blockId, clearExisting };
  }
}

export class ReplaceBlocks implements Action {
  readonly type = REPLACE_BLOCKS;
  readonly payload: { blocks: ReadonlyArray<AnimationBlock<any>> };
  constructor(readonly blocks: ReadonlyArray<AnimationBlock<any>>) {
    this.payload = { blocks };
  }
}

// Layer constants.
export const REPLACE_LAYER = 'REPLACE_LAYER';
export const SELECT_LAYER = 'SELECT_LAYER';
export const TOGGLE_LAYER_EXPANSION = 'TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = 'TOGGLE_LAYER_VISIBILITY';
export const ADD_LAYERS = 'ADD_LAYERS';
export const DELETE_SELECTED_LAYERS = 'DELETE_SELECTED_LAYERS';

export class ReplaceLayer implements Action {
  readonly type = REPLACE_LAYER;
  readonly payload: { layer: Layer };
  constructor(readonly layer: Layer) {
    this.payload = { layer };
  }
}

export class SelectLayer implements Action {
  readonly type = SELECT_LAYER;
  readonly payload: { layerId: string, clearExisting: boolean };
  constructor(readonly layerId: string, readonly clearExisting = true) {
    this.payload = { layerId, clearExisting };
  }
}

export class ToggleLayerExpansion implements Action {
  readonly type = TOGGLE_LAYER_EXPANSION;
  readonly payload: { layerId: string, recursive: boolean };
  constructor(readonly layerId: string, readonly recursive = false) {
    this.payload = { layerId, recursive };
  }
}

export class ToggleLayerVisibility implements Action {
  readonly type = TOGGLE_LAYER_VISIBILITY;
  readonly payload: { layerId: string };
  constructor(readonly layerId: string) {
    this.payload = { layerId };
  }
}

export class AddLayers implements Action {
  readonly type = ADD_LAYERS;
  readonly payload: { layers: ReadonlyArray<Layer> };
  constructor(...layers: Layer[]) {
    this.payload = { layers };
  }
}

// General actions.

export const DELETE_SELECTED_MODELS = 'DELETE_SELECTED_MODELS';

export class DeleteSelectedModels implements Action {
  readonly type = DELETE_SELECTED_MODELS;
}

export type Actions =
  AddAnimations
  | SelectAnimation
  | ActivateAnimation
  | ReplaceAnimations
  | AddBlock
  | SelectBlock
  | ReplaceBlocks
  | ReplaceLayer
  | SelectLayer
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | AddLayers
  | DeleteSelectedModels;
