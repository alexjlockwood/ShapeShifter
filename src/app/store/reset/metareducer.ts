import { State } from '..';
import * as actions from './metaactions';
import { ActionReducer } from '@ngrx/store';

export function metaReducer(reducer: ActionReducer<State>): ActionReducer<State> {
  return (state: State, action: actions.Actions) => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    }
    state = reducer(state, action);
    if (action.type === actions.RESET_WORKSPACE) {
      const { vectorLayer, animations, hiddenLayerIds } = action.payload;
      if (vectorLayer) {
        const { present } = state;
        const { layers } = present;
        state = {
          ...state,
          present: {
            ...present,
            layers: {
              ...layers,
              vectorLayer,
              hiddenLayerIds,
            },
          },
        };
      }
      if (animations) {
        const { present } = state;
        const { timeline } = present;
        state = {
          ...state,
          present: {
            ...present,
            timeline: {
              ...timeline,
              animations,
              activeAnimationId: animations[0].id,
            },
          },
        };
      }
    }
    return state;
  };
}
