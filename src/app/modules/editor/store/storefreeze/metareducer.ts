import { Action, ActionReducer } from 'app/modules/editor/store';
import deepFreeze from 'deep-freeze-strict';

/**
 * Meta reducer that prevents state from being mutated anywhere in the app.
 */
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state: T | undefined, action: Action) => {
    if (state) {
      deepFreeze(state);
    }
    const nextState = reducer(state, action);
    if (nextState) {
      deepFreeze(nextState);
    }
    return nextState;
  };
}
