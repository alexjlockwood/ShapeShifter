import { ModelUtil } from 'app/scripts/common';
import { ColorProperty, PathProperty } from 'app/scripts/model/properties';
import { Animation, AnimationBlock } from 'app/scripts/model/timeline';
import * as _ from 'lodash';

import * as actions from './actions';

export interface State {
  readonly animation: Animation;
  readonly isAnimationSelected: boolean;
  readonly selectedBlockIds: Set<string>;
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
    case actions.REPLACE_ANIMATION: {
      return { ...state, animation: action.payload };
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

function selectBlockId(state: State, blockId: string, clearExisting: boolean) {
  const selectedBlockIds = new Set(state.selectedBlockIds);
  if (clearExisting) {
    selectedBlockIds.forEach(id => {
      if (id !== blockId) {
        selectedBlockIds.delete(id);
      }
    });
  }
  if (!clearExisting && selectedBlockIds.has(blockId)) {
    selectedBlockIds.delete(blockId);
  } else {
    selectedBlockIds.add(blockId);
  }
  return { ...state, isAnimationSelected: false, selectedBlockIds };
}
