import { Action } from '@ngrx/store';
import { Animation } from '../../animations';

export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';

export class AddAnimations implements Action {
  readonly type = ADD_ANIMATIONS;
  constructor(public readonly payload: ReadonlyArray<Animation>) { }
}

export type Actions = AddAnimations;
