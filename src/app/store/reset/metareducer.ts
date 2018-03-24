import { ActionReducer } from 'app/store/ngrx';
import { AppState } from 'app/store/reducer';

import { ResetActionTypes, ResetActions } from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: ResetActions) => {
    if (action.type === ResetActionTypes.ResetWorkspace) {
      state = undefined;
    }
    return reducer(state, action);
  };
}
