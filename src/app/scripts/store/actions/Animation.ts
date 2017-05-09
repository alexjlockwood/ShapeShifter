import { Action } from '@ngrx/store';
import { Animation } from '../../animations';

export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const SELECT_ANIMATION_ID = 'SELECT_ANIMATION_ID';
export const ACTIVATE_ANIMATION_ID = 'ACTIVATE_ANIMATION_ID';

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

export type Actions =
  AddAnimations
  | SelectAnimationId
  | ActivateAnimationId;
