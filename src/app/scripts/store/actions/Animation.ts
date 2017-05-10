import { Action } from '@ngrx/store';
import { Layer } from '../../layers';
import { Animation, AnimationBlock } from '../../animations';

export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION_ID = 'SELECT_ANIMATION_ID';
export const ACTIVATE_ANIMATION_ID = 'ACTIVATE_ANIMATION_ID';
export const ADD_ANIMATION_BLOCK = 'ADD_ANIMATION_BLOCK';
export const SELECT_ANIMATION_BLOCK_ID = 'SELECT_ANIMATION_BLOCK_ID';
export const REPLACE_ANIMATION_BLOCKS = 'REPLACE_ANIMATION_BLOCKS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(readonly animations: ReadonlyArray<Animation>) {
    this.payload = { animations };
  }
}

export class SelectAnimationId implements Action {
  readonly type = SELECT_ANIMATION_ID;
  readonly payload: { animationId: string };
  constructor(readonly animationId: string) {
    this.payload = { animationId };
  }
}

export class ActivateAnimationId implements Action {
  readonly type = ACTIVATE_ANIMATION_ID;
  readonly payload: { animationId: string };
  constructor(readonly animationId: string) {
    this.payload = { animationId };
  }
}

export class AddAnimationBlock implements Action {
  readonly type = ADD_ANIMATION_BLOCK;
  readonly payload: { layer: Layer, propertyName: string };
  constructor(readonly layer: Layer, readonly propertyName: string) {
    this.payload = { layer, propertyName };
  }
}

export class SelectAnimationBlockId implements Action {
  readonly type = SELECT_ANIMATION_BLOCK_ID;
  readonly payload: { animationBlockId: string, clearExisting: boolean };
  constructor(readonly animationBlockId: string, readonly clearExisting = true) {
    this.payload = { animationBlockId, clearExisting };
  }
}

export class ReplaceAnimationBlocks implements Action {
  readonly type = REPLACE_ANIMATION_BLOCKS;
  readonly payload: { animationBlocks: ReadonlyArray<AnimationBlock<any>> };
  constructor(readonly animationBlocks: ReadonlyArray<AnimationBlock<any>>) {
    this.payload = { animationBlocks };
  }
}

export type Actions =
  AddAnimations
  | SelectAnimationId
  | ActivateAnimationId
  | AddAnimationBlock
  | SelectAnimationBlockId
  | ReplaceAnimationBlocks;
