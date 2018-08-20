import { Animation } from 'app/modules/editor/model/timeline';
import { Action } from 'app/modules/editor/store';

export enum TimelineActionTypes {
  SetAnimation = '__timeline__SET_ANIMATION',
  SelectAnimation = '__timeline__SELECT_ANIMATION',
  SetSelectedBlocks = '__timeline__SET_SELECTED_BLOCKS',
}

export class SetAnimation implements Action {
  readonly type = TimelineActionTypes.SetAnimation;
  readonly payload: { animation: Animation };
  constructor(animation: Animation) {
    this.payload = { animation };
  }
}

export class SelectAnimation implements Action {
  readonly type = TimelineActionTypes.SelectAnimation;
  readonly payload: { isAnimationSelected: boolean };
  constructor(isAnimationSelected: boolean) {
    this.payload = { isAnimationSelected };
  }
}

export class SetSelectedBlocks implements Action {
  readonly type = TimelineActionTypes.SetSelectedBlocks;
  readonly payload: { blockIds: ReadonlySet<string> };
  constructor(blockIds: ReadonlySet<string>) {
    this.payload = { blockIds };
  }
}

export type TimelineActions = SetAnimation | SelectAnimation | SetSelectedBlocks;
