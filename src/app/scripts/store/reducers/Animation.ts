import { createSelector } from 'reselect';
import { Animation } from '../../animations';
import * as animation from '../actions/Animation';

export interface State {
  animations: ReadonlyArray<Animation>,
};

export const initialState: State = {
  animations: [],
};

export function reducer(state = initialState, action: animation.Actions): State {
  switch (action.type) {
    case animation.ADD_ANIMATIONS:
      return {
        animations: state.animations.concat(...action.payload),
      };
    default: {
      return state;
    }
  }
}

export const getAnimations = (state: State) => state.animations;
