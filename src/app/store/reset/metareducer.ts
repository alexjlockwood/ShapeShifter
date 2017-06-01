import * as actions from './metaactions';
import { ActionReducer } from '@ngrx/store';

export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state: T, action: actions.Actions): T => {
    if (action.type === actions.RESET_WORKSPACE) {
      return undefined;
    }
    return reducer(state, action);
  };
}
