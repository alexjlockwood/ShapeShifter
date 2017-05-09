import { Action } from '@ngrx/store';
import { Layer } from '../../layers';
import { Animation, AnimationBlock } from '../../animations';

export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION_ID = 'SELECT_ANIMATION_ID';
export const ACTIVATE_ANIMATION_ID = 'ACTIVATE_ANIMATION_ID';
export const ADD_ANIMATION_BLOCK = 'ADD_ANIMATION_BLOCK';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  constructor(public readonly payload: ReadonlyArray<Animation>) { }
}

export class SelectAnimationId implements Action {
  readonly type = SELECT_ANIMATION_ID;
  constructor(public readonly payload: string) { }
}

export class ActivateAnimationId implements Action {
  readonly type = ACTIVATE_ANIMATION_ID;
  constructor(public readonly payload: string) { }
}

export class AddAnimationBlock implements Action {
  readonly type = ADD_ANIMATION_BLOCK;
  public readonly payload: { layer: Layer, propertyName: string };
  constructor(readonly layer: Layer, readonly propertyName: string) {
    this.payload = { layer, propertyName };
  }
}

export type Actions =
  AddAnimations
  | SelectAnimationId
  | ActivateAnimationId
  | AddAnimationBlock;
