import { CanvasType } from '../../CanvasType';
import { Animation, AnimationBlock } from '../../scripts/animations';
import { Layer } from '../../scripts/layers';
import { Path } from '../../scripts/paths';
import { Action } from '@ngrx/store';

export const SELECT_ANIMATION = '__aia__SELECT_ANIMATION';
export const SELECT_BLOCK = '__aia__SELECT_BLOCK';
export const SELECT_LAYER = '__aia__SELECT_LAYER';
export const DELETE_SELECTED_MODELS = '__aia__DELETE_SELECTED_MODELS';

export class SelectAnimation implements Action {
  readonly type = SELECT_ANIMATION;
  readonly payload: { animationId: string, clearExisting: boolean };
  constructor(animationId: string, clearExisting = false) {
    this.payload = { animationId, clearExisting };
  }
}

export class SelectBlock implements Action {
  readonly type = SELECT_BLOCK;
  readonly payload: { blockId: string, clearExisting: boolean };
  constructor(blockId: string, clearExisting = true) {
    this.payload = { blockId, clearExisting };
  }
}

export class SelectLayer implements Action {
  readonly type = SELECT_LAYER;
  readonly payload: { layerId: string, shouldToggle: boolean, clearExisting: boolean };
  constructor(layerId: string, shouldToggle: boolean, clearExisting: boolean) {
    this.payload = { layerId, shouldToggle, clearExisting };
  }
}

export class DeleteSelectedModels implements Action {
  readonly type = DELETE_SELECTED_MODELS;
}

export type Actions =
  SelectAnimation
  | SelectBlock
  | SelectLayer
  | DeleteSelectedModels;
