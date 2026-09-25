import { Action, ActionReducer } from 'app/modules/editor/store';
import { EditorState } from 'app/modules/editor/store/reducer';

import { BatchAction, BatchActionTypes } from './actions';

export function metaReducer(reducer: ActionReducer<EditorState>): ActionReducer<EditorState> {
  return (state: EditorState | undefined, action: Action) => {
    const isBatchAction = action.type === BatchActionTypes.BatchAction;
    const actions = isBatchAction ? (action as BatchAction).payload : [action];
    // The result is only undefined for an empty batch that's dispatched before there's a state.
    return actions.reduce<EditorState | undefined>(reducer, state) ?? reducer(state, action);
  };
}
