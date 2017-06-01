import * as actions from './actions';
import { ActionReducer } from '@ngrx/store';

export function reducer<T>(state: T, action: actions.Actions): T {
  if (action.type === actions.RESET_WORKSPACE) {
    return undefined;
  };
  return state;
}
