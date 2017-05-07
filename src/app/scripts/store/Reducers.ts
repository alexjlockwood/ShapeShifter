import { ActionReducer, Action } from '@ngrx/store';
import { Animation } from '../animations';
import { VectorLayer } from '../layers';

// Reducer action types.
export const ADD_ANIMATIONS = 'ADD_ANIMATIONS';
export const ADD_VECTOR_LAYERS = 'ADD_VECTOR_LAYERS';

// TODO: can we use type checking to ensure the payloads below are structured properly?

export function animationsReducer(state: ReadonlyArray<Animation> = [], action: Action) {
  switch (action.type) {
    case ADD_ANIMATIONS:
      return state.concat(...action.payload);
  }
  return state;
}

export function vectorLayersReducer(state: ReadonlyArray<VectorLayer> = [], action: Action) {
  switch (action.type) {
    case ADD_VECTOR_LAYERS:
      return state.concat(...action.payload);
  }
  return state;
}
