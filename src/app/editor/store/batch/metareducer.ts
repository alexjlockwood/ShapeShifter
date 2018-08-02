import { ActionReducer } from 'app/editor/store';
import { AppState } from 'app/editor/store/reducer';

import { BatchActionTypes, BatchActions } from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: BatchActions) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    return (isBatchAction ? action.payload : [action]).reduce(reducer, state);
  };
}
