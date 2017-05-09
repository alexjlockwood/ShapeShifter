import { createSelector } from 'reselect';
import { Animation } from '../../animations';
import * as animation from '../actions/Animation';

export interface State {
  animations: ReadonlyArray<Animation>;
  selectedAnimationId: string;
  activeAnimationId: string;
}

export const initialState: State = {
  animations: [],
  selectedAnimationId: '',
  activeAnimationId: '',
};

export function reducer(state = initialState, action: animation.Actions): State {
  switch (action.type) {
    case animation.ADD_ANIMATIONS: {
      const animations = state.animations.concat(...action.payload);
      let { activeAnimationId } = state;
      if (!state.animations.length) {
        // Auto-activate the first animation if this is the first
        // animation in the store.
        activeAnimationId = animations[0].id;
      }
      return { ...state, animations, activeAnimationId };
    }
    case animation.SELECT_ANIMATION_ID: {
      // Selecting an animation ID also makes it active.
      const activeAnimationId = action.payload;
      const selectedAnimationId = action.payload;
      return { ...state, selectedAnimationId, activeAnimationId };
    }
    case animation.ACTIVATE_ANIMATION_ID: {
      return { ...state, activeAnimationId: action.payload };
    }
    default: {
      return state;
    }
  }
}
