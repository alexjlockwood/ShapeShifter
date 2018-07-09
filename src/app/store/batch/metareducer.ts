import { ActionReducer } from 'app/store';
import { AppState } from 'app/store/reducer';

import { BatchActionTypes, BatchActions } from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: BatchActions) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    return (isBatchAction ? action.payload : [action]).reduce(reducer, state);
  };
}
