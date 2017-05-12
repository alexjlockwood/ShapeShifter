import { Action } from '@ngrx/store';
import { Animation, AnimationBlock } from '../scripts/animations';
import { VectorLayer, Layer } from '../scripts/layers';

// Animation actions.
export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION_ID = 'SELECT_ANIMATION_ID';
export const ACTIVATE_ANIMATION_ID = 'ACTIVATE_ANIMATION_ID';
export const REPLACE_ANIMATIONS = 'REPLACE_ANIMATIONS';
export const ADD_BLOCK = 'ADD_BLOCK';
export const SELECT_BLOCK_ID = 'SELECT_BLOCK_ID';
export const REPLACE_BLOCKS = 'REPLACE_BLOCKS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(readonly animations: ReadonlyArray<Animation>) {
    this.payload = { animations };
  }
}

export class SelectAnimationId implements Action {
  readonly type = SELECT_ANIMATION_ID;
  readonly payload: { animationId: string, clearExisting: boolean };
  constructor(readonly animationId: string, readonly clearExisting = false) {
    this.payload = { animationId, clearExisting };
  }
}

export class ActivateAnimationId implements Action {
  readonly type = ACTIVATE_ANIMATION_ID;
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

export class SelectBlockId implements Action {
  readonly type = SELECT_BLOCK_ID;
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

// VectorLayer constants.
export const ADD_VECTOR_LAYERS = 'ADD_VECTOR_LAYERS';
export const REPLACE_VECTOR_LAYER = 'REPLACE_VECTOR_LAYER';
export const SELECT_LAYER_ID = 'SELECT_LAYER_ID';
export const TOGGLE_LAYER_ID_EXPANSION = 'TOGGLE_LAYER_ID_EXPANSION';
export const TOGGLE_LAYER_ID_VISIBILITY = 'TOGGLE_LAYER_ID_VISIBILITY';
export const ADD_LAYER = 'ADD_LAYER';

export class AddVectorLayers implements Action {
  readonly type = ADD_VECTOR_LAYERS;
  readonly payload: { vectorLayers: ReadonlyArray<VectorLayer> };
  constructor(readonly vectorLayers: ReadonlyArray<VectorLayer>) {
    this.payload = { vectorLayers };
  }
}

export class ReplaceVectorLayer implements Action {
  readonly type = REPLACE_VECTOR_LAYER;
  readonly payload: { vectorLayer: VectorLayer };
  constructor(readonly vectorLayer: VectorLayer) {
    this.payload = { vectorLayer };
  }
}

export class SelectLayerId implements Action {
  readonly type = SELECT_LAYER_ID;
  readonly payload: { layerId: string, clearExisting: boolean };
  constructor(readonly layerId: string, readonly clearExisting = true) {
    this.payload = { layerId, clearExisting };
  }
}

export class ToggleLayerIdExpansion implements Action {
  readonly type = TOGGLE_LAYER_ID_EXPANSION;
  readonly payload: { layerId: string, recursive: boolean };
  constructor(readonly layerId: string, readonly recursive = false) {
    this.payload = { layerId, recursive };
  }
}

export class ToggleLayerIdVisibility implements Action {
  readonly type = TOGGLE_LAYER_ID_VISIBILITY;
  readonly payload: { layerId: string, recursive: boolean };
  constructor(readonly layerId: string, readonly recursive = false) {
    this.payload = { layerId, recursive };
  }
}

export class AddLayer implements Action {
  readonly type = ADD_LAYER;
  readonly payload: { layer: Layer };
  constructor(readonly layer: Layer) {
    this.payload = { layer };
  }
}

export type Actions =
  AddAnimations
  | SelectAnimationId
  | ActivateAnimationId
  | ReplaceAnimations
  | AddBlock
  | SelectBlockId
  | ReplaceBlocks
  | AddVectorLayers
  | ReplaceVectorLayer
  | SelectLayerId
  | ToggleLayerIdExpansion
  | ToggleLayerIdVisibility
  | AddLayer;
