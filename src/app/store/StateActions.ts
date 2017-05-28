import { Action } from '@ngrx/store';
import { Animation, AnimationBlock } from '../scripts/animations';
import { Layer } from '../scripts/layers';
import { Hover, Selection, AppMode } from './StateReducer';
import { CanvasType } from '../CanvasType';

// Animation actions.
export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION = 'SELECT_ANIMATION';
export const ACTIVATE_ANIMATION = 'ACTIVATE_ANIMATION_ID';
export const REPLACE_ANIMATIONS = 'REPLACE_ANIMATIONS';

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
export const ADD_BLOCK = 'ADD_BLOCK';
export const SELECT_BLOCK = 'SELECT_BLOCK';
export const REPLACE_BLOCKS = 'REPLACE_BLOCKS';

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
export const ADD_LAYERS = 'ADD_LAYERS';
export const SELECT_LAYER = 'SELECT_LAYER';
export const CLEAR_LAYER_SELECTIONS = 'CLEAR_LAYER_SELECTIONS';
export const TOGGLE_LAYER_EXPANSION = 'TOGGLE_LAYER_EXPANSION';
export const TOGGLE_LAYER_VISIBILITY = 'TOGGLE_LAYER_VISIBILITY';
export const REPLACE_LAYER = 'REPLACE_LAYER';

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
export const DELETE_SELECTED_MODELS = 'DELETE_SELECTED_MODELS';

export class DeleteSelectedModels implements Action {
  readonly type = DELETE_SELECTED_MODELS;
}

// Shape Shifter actions.
export const SET_APP_MODE = 'SET_APP_MODE';
export const SET_HOVER = 'SET_HOVER';
export const SET_SELECTIONS = 'SET_SELECTIONS';
export const TOGGLE_SUBPATH_SELECTION = 'TOGGLE_SUBPATH_SELECTION';
export const TOGGLE_SEGMENT_SELECTIONS = 'TOGGLE_SEGMENT_SELECTION';
export const TOGGLE_POINT_SELECTION = 'TOGGLE_POINT_SELECTION';

export class SetAppMode implements Action {
  readonly type = SET_APP_MODE;
  readonly payload: { appMode: AppMode };
  constructor(readonly appMode: AppMode) {
    this.payload = { appMode };
  }
}

export class SetHover implements Action {
  readonly type = SET_HOVER;
  readonly payload: { hover: Hover };
  constructor(readonly hover: Hover) {
    this.payload = { hover };
  }
}

export class SetSelections implements Action {
  readonly type = SET_SELECTIONS;
  readonly payload: { selections: ReadonlyArray<Selection> };
  constructor(readonly selections: ReadonlyArray<Selection>) {
    this.payload = { selections };
  }
}

export class ToggleSubPathSelection implements Action {
  readonly type = TOGGLE_SUBPATH_SELECTION;
  readonly payload: { source: CanvasType, subIdx: number };
  // TODO: support multi-selection for subpaths
  constructor(source: CanvasType, subIdx: number) {
    this.payload = { source, subIdx };
  }
}

export class ToggleSegmentSelections implements Action {
  readonly type = TOGGLE_SEGMENT_SELECTIONS;
  readonly payload: {
    source: CanvasType,
    segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>,
  };
  // TODO: support multi-selection for segments
  constructor(source: CanvasType, segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }>) {
    this.payload = { source, segments };
  }
}

export class TogglePointSelection implements Action {
  readonly type = TOGGLE_POINT_SELECTION;
  readonly payload: {
    source: CanvasType,
    subIdx: number,
    cmdIdx: number,
    appendToList: boolean,
  };
  constructor(source: CanvasType, subIdx: number, cmdIdx: number, appendToList = false) {
    this.payload = { source, subIdx, cmdIdx, appendToList };
  }
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
  | SetAppMode
  | SetHover
  | SetSelections
  | ToggleSubPathSelection
  | ToggleSegmentSelections
  | TogglePointSelection
  | DeleteSelectedModels;
