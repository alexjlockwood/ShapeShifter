import { Action, ActionReducer } from 'app/modules/editor/store';
import { EditorState } from 'app/modules/editor/store/reducer';

import { ResetActionTypes, ResetWorkspace } from './actions';

export function metaReducer(reducer: ActionReducer<EditorState>): ActionReducer<EditorState> {
  return (state: EditorState, action: Action) => {
    if (action.type === ResetActionTypes.ResetWorkspace) {
      state = undefined;
    }
    state = reducer(state, action);
    if (action.type === ResetActionTypes.ResetWorkspace) {
      const { vectorLayer, animation, hiddenLayerIds } = (action as ResetWorkspace).payload;
      if (vectorLayer) {
        const { layers } = state;
        state = {
          ...state,
          layers: {
            ...layers,
            vectorLayer,
            hiddenLayerIds,
          },
        };
      }
      if (animation) {
        const { timeline } = state;
        state = {
          ...state,
          timeline: {
            ...timeline,
            animation,
          },
        };
      }
    }
    return state;
  };
}
