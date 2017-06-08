import { AppState } from '../reducer';
import * as actions from './metaactions';
import { ActionReducer } from '@ngrx/store';

export function metaReducer(reducer: ActionReducer<AppState>): ActionReducer<AppState> {
  return (state: AppState, action: actions.Actions) => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    }
    state = reducer(state, action);
    if (action.type === actions.RESET_WORKSPACE) {
      const { vectorLayer, animations, hiddenLayerIds } = action.payload;
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
      if (animations) {
        const { timeline } = state;
        state = {
          ...state,
          timeline: {
            ...timeline,
            animations,
            activeAnimationId: animations[0].id,
          },
        };
      }
    }
    return state;
  };
}
