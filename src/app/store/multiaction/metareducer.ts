import { ActionReducer } from 'app/store/ngrx';
import { AppState } from 'app/store/reducer';

import * as actions from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: actions.Actions) => {
    const isMultiAction = action.type === actions.MULTI_ACTION;
    return (isMultiAction ? action.payload : [action]).reduce(reducer, state);
  };
}
