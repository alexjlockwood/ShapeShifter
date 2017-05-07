import { ActionReducer, Action } from '@ngrx/store';
import { Animation } from '../animations';

// Reducer action types.
export const ADD_ANIMATION = 'ADD_ANIMATION';

// TODO: can we use type checking to ensure the payloads are structured properly?
export function animationsReducer(state: ReadonlyArray<Animation> = [], action: Action) {
  switch (action.type) {
    case ADD_ANIMATION:
      return state.concat(action.payload.animation);
    default:
      return state;
  }
}
