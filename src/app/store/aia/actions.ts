import { CanvasType } from '../../CanvasType';
import { Animation, AnimationBlock } from '../../scripts/animations';
import { Layer } from '../../scripts/layers';
import { Path } from '../../scripts/paths';
import { Action } from '@ngrx/store';

// Animation actions.
export const ADD_ANIMATIONS = '__aia__ADD_ANIMATIONS';
export const SELECT_ANIMATION = '__aia__SELECT_ANIMATION';
export const ACTIVATE_ANIMATION = '__aia__ACTIVATE_ANIMATION_ID';
export const REPLACE_ANIMATIONS = '__aia__REPLACE_ANIMATIONS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(...animations: Animation[]) {
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

// Block actions.
export const ADD_BLOCK = '__aia__ADD_BLOCK';
export const SELECT_BLOCK = '__aia__SELECT_BLOCK';
export const REPLACE_BLOCKS = '__aia__REPLACE_BLOCKS';

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
  readonly payload: { blocks: ReadonlyArray<AnimationBlock> };
  constructor(readonly blocks: ReadonlyArray<AnimationBlock>) {
    this.payload = { blocks };
  }
}

// Layer actions.
export const ADD_LAYERS = '__aia__ADD_LAYERS';
export const SELECT_LAYER = '__aia__SELECT_LAYER';
export const CLEAR_LAYER_SELECTIONS = '__aia__CLEAR_LAYER_SELECTIONS';
export const TOGGLE_LAYER_EXPANSION = '__aia__TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = '__aia__TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = '__aia__REPLACE_LAYER';

export class AddLayers implements Action {
  readonly type = ADD_LAYERS;
  readonly payload: { layers: ReadonlyArray<Layer> };
  constructor(layers: ReadonlyArray<Layer>) {
    this.payload = { layers };
  }
}

export class SelectLayer implements Action {
  readonly type = SELECT_LAYER;
  readonly payload: { layerId: string, shouldToggle: boolean, clearExisting: boolean };
  constructor(
    readonly layerId: string,
    readonly shouldToggle: boolean,
    readonly clearExisting: boolean,
  ) {
    this.payload = { layerId, shouldToggle, clearExisting };
  }
}

export class ClearLayerSelections implements Action {
  readonly type = CLEAR_LAYER_SELECTIONS;
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

// TODO: change this to 'replace layers' (plural)
export class ReplaceLayer implements Action {
  readonly type = REPLACE_LAYER;
  readonly payload: { layer: Layer };
  constructor(readonly layer: Layer) {
    this.payload = { layer, };
  }
}

// Miscellaneous actions.
export const DELETE_SELECTED_MODELS = '__aia__DELETE_SELECTED_MODELS';

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
  | AddLayers
  | SelectLayer
  | ClearLayerSelections
  | ToggleLayerExpansion
  | ToggleLayerVisibility
  | ReplaceLayer
  | DeleteSelectedModels;
