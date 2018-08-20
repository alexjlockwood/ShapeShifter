import { ActionReducer } from 'app/modules/editor/store';
import { EditorState } from 'app/modules/editor/store/reducer';

import { BatchActionTypes, BatchActions } from './actions';

export function metaReducer(reducer: ActionReducer<EditorState>): ActionReducer<EditorState> {
  return (state: EditorState, action: BatchActions) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    return (isBatchAction ? action.payload : [action]).reduce(reducer, state);
  };
}
