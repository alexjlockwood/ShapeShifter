import { Animation } from 'app/modules/editor/model/timeline';

import { TimelineActionTypes, TimelineActions } from './actions';

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

export function reducer(state = buildInitialState(), action: TimelineActions) {
  switch (action.type) {
    case TimelineActionTypes.SetAnimation:
      return { ...state, animation: action.payload.animation };
    case TimelineActionTypes.SelectAnimation:
      return { ...state, isAnimationSelected: action.payload.isAnimationSelected };
    case TimelineActionTypes.SetSelectedBlocks:
      return { ...state, selectedBlockIds: new Set<string>(action.payload.blockIds) };
  }
  return state;
}
