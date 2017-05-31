import * as actions from './actions';
import { Action, ActionReducer } from '@ngrx/store';

// Meta-reducer that intercepts reset workspace actions to reset the current state.
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state: T, action: actions.Actions): T => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    };
    return reducer(state, action);
  };
}
