import { ActionReducer } from '@ngrx/store';
import { AppState } from 'app/store/reducer';

import * as actions from './actions';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: actions.Actions) => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    }
    state = reducer(state, action);
    if (action.type === actions.RESET_WORKSPACE) {
      const { vectorLayer, animation, hiddenLayerIds } = action.payload;
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
