import { CanvasType } from '../../CanvasType';
import { Animation, AnimationBlock } from '../../scripts/animations';
import { Layer } from '../../scripts/layers';
import { Action } from '@ngrx/store';

// Animation actions.
export const ADD_ANIMATIONS = '__timeline__ADD_ANIMATIONS';
export const ACTIVATE_ANIMATION = '__timeline__ACTIVATE_ANIMATION_ID';
export const REPLACE_ANIMATIONS = '__timeline__REPLACE_ANIMATIONS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(...animations: Animation[]) {
    this.payload = { animations };
  }
}

export class ActivateAnimation implements Action {
  readonly type = ACTIVATE_ANIMATION;
  readonly payload: { animationId: string };
  constructor(animationId: string) {
    this.payload = { animationId };
  }
}

export class ReplaceAnimations implements Action {
  readonly type = REPLACE_ANIMATIONS;
  readonly payload: { animations: ReadonlyArray<Animation> };
  constructor(animations: ReadonlyArray<Animation>) {
    this.payload = { animations };
  }
}

// Block actions.
export const ADD_BLOCK = '__timeline__ADD_BLOCK';
export const REPLACE_BLOCKS = '__timeline__REPLACE_BLOCKS';

export class AddBlock implements Action {
  readonly type = ADD_BLOCK;
  readonly payload: { layer: Layer, propertyName: string, fromValue: any, toValue: any };
  constructor(layer: Layer, propertyName: string, fromValue: any, toValue: any) {
    this.payload = { layer, propertyName, fromValue, toValue };
  }
}

export class ReplaceBlocks implements Action {
  readonly type = REPLACE_BLOCKS;
  readonly payload: { blocks: ReadonlyArray<AnimationBlock> };
  constructor(blocks: ReadonlyArray<AnimationBlock>) {
    this.payload = { blocks };
  }
}

export type Actions =
  AddAnimations
  | ActivateAnimation
  | ReplaceAnimations
  | AddBlock
  | ReplaceBlocks;
