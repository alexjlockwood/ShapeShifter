import { Animation } from 'app/model/timeline';

import * as actions from './actions';

export interface State {
  readonly animation: Animation;
  readonly isAnimationSelected: boolean;
  readonly selectedBlockIds: ReadonlySet<string>;
}

export function buildInitialState() {
  return {
    animation: new Animation(),
    isAnimationSelected: false,
    selectedBlockIds: new Set<string>(),
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
  switch (action.type) {
    case actions.SET_ANIMATION: {
      return { ...state, animation: action.payload.animation };
    }
    case actions.SELECT_ANIMATION: {
      return { ...state, isAnimationSelected: action.payload.isAnimationSelected };
    }
    case actions.SET_SELECTED_BLOCKS: {
      return { ...state, selectedBlockIds: new Set<string>(action.payload.blockIds) };
    }
  }
  return state;
}
