import { Action, ActionReducer } from 'app/modules/editor/store';
import { EditorState } from 'app/modules/editor/store/reducer';

import { BatchAction, BatchActionTypes } from './actions';

export function metaReducer(reducer: ActionReducer<EditorState>): ActionReducer<EditorState> {
  return (state: EditorState, action: Action) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    return (isBatchAction ? (action as BatchAction).payload : [action]).reduce(reducer, state);
  };
}
