import { Action, ActionReducer } from '@ngrx/store';
import * as deepFreeze from 'deep-freeze-strict';

/**
 * Meta reducer that prevents state from being mutated anywhere in the app.
 */
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state: T, action: Action) => {
    if (state) {
      deepFreeze(state);
    }
    if (action.payload) {
      // Guard against trying to freeze null or undefined types.
      deepFreeze(action.payload);
    }
    const nextState = reducer(state, action);
    if (nextState) {
      deepFreeze(nextState);
    }
    return nextState;
  };
}
