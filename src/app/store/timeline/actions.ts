import { Action } from '@ngrx/store';
import { Layer } from 'app/scripts/model/layers';
import { Animation, AnimationBlock } from 'app/scripts/model/timeline';

export const REPLACE_ANIMATION = '__timeline__REPLACE_ANIMATION';
export const SELECT_ANIMATION = '__timeline__SELECT_ANIMATION';
export const SET_SELECTED_BLOCKS = '__timeline__SET_SELECTED_BLOCKS';

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

export class SetSelectedBlocks implements Action {
  readonly type = SET_SELECTED_BLOCKS;
  readonly payload: { blockIds: Set<string> };
  constructor(blockIds: Set<string>) {
    this.payload = { blockIds };
  }
}

export type Actions = ReplaceAnimation | SelectAnimation | SetSelectedBlocks;
