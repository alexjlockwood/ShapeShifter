import { ActionReducer } from 'app/store/ngrx';
import { AppState } from 'app/store/reducer';

import * as actions from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: actions.Actions) => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    }
    return reducer(state, action);
  };
}
