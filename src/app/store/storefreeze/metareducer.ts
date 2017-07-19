import { Action, ActionReducer } from '@ngrx/store';
import * as deepFreeze from 'deep-freeze-strict';
import * as _ from 'lodash';

/**
 * Meta reducer that prevents state from being mutated anywhere in the app.
 */
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state: T, action: Action) => {
    if (state) {
      deepFreeze(state);
    }
    for (const key in action) {
      // Guard against trying to freeze null or undefined types.
      if (action.hasOwnProperty(key) && !_.isNil(action[key])) {
        deepFreeze(action[key]);
      }
    }
    const nextState = reducer(state, action);
    if (nextState) {
      deepFreeze(nextState);
    }
    return nextState;
  };
}
