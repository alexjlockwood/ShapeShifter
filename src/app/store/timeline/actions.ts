import {
  ClearSelections,
  DeleteSelectedModels,
} from '../common/actions';
import { SelectLayer } from '../layers/actions';
import { Action } from '@ngrx/store';
import { Layer } from 'app/scripts/model/layers';
import { Animation, AnimationBlock } from 'app/scripts/model/timeline';

export const REPLACE_ANIMATION = '__timeline__REPLACE_ANIMATION';
export const SELECT_ANIMATION = '__timeline__SELECT_ANIMATION';
export const ADD_BLOCK = '__timeline__ADD_BLOCK';
export const REPLACE_BLOCKS = '__timeline__REPLACE_BLOCKS';
export const SELECT_BLOCK = '__timeline__SELECT_BLOCK';
export { SELECT_LAYER } from '../layers/actions';
export { CLEAR_SELECTIONS, DELETE_SELECTED_MODELS } from '../common/actions';

export class ReplaceAnimation implements Action {
  readonly type = REPLACE_ANIMATION;
  readonly payload: { animation: Animation };
  constructor(animation: Animation) {
    this.payload = { animation };
  }
}

export class SelectAnimation implements Action {
  readonly type = SELECT_ANIMATION;
  readonly payload: { isAnimationSelected: boolean };
  constructor(isAnimationSelected: boolean) {
    this.payload = { isAnimationSelected };
  }
}

export class AddBlock implements Action {
  readonly type = ADD_BLOCK;
  readonly payload: {
    layer: Layer,
    propertyName: string,
    fromValue: any,
    toValue: any,
    activeTime: number,
  };
  constructor(
    layer: Layer,
    propertyName: string,
    fromValue: any,
    toValue: any,
    activeTime: number,
  ) {
    this.payload = { layer, propertyName, fromValue, toValue, activeTime };
  }
}

export class ReplaceBlocks implements Action {
  readonly type = REPLACE_BLOCKS;
  readonly payload: { blocks: ReadonlyArray<AnimationBlock> };
  constructor(blocks: ReadonlyArray<AnimationBlock>) {
    this.payload = { blocks };
  }
}

export class SelectBlock implements Action {
  readonly type = SELECT_BLOCK;
  readonly payload: { blockId: string, clearExisting: boolean };
  constructor(blockId: string, clearExisting = true) {
    this.payload = { blockId, clearExisting };
  }
}

export type Actions =
  ReplaceAnimation
  | SelectAnimation
  | AddBlock
  | ReplaceBlocks
  | SelectBlock
  | SelectLayer
  | ClearSelections
  | DeleteSelectedModels;
