import { Action } from '@ngrx/store';
import { Animation } from 'app/model/timeline';

export const SET_ANIMATION = '__timeline__SET_ANIMATION';
export const SELECT_ANIMATION = '__timeline__SELECT_ANIMATION';
export const SET_SELECTED_BLOCKS = '__timeline__SET_SELECTED_BLOCKS';

export class SetAnimation implements Action {
  readonly type = SET_ANIMATION;
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

export class SetSelectedBlocks implements Action {
  readonly type = SET_SELECTED_BLOCKS;
  readonly payload: { blockIds: ReadonlySet<string> };
  constructor(blockIds: ReadonlySet<string>) {
    this.payload = { blockIds };
  }
}

export type Actions = SetAnimation | SelectAnimation | SetSelectedBlocks;
