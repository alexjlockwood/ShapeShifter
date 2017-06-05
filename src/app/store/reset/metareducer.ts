import { State } from '../reducer';
import * as actions from './metaactions';
import { ActionReducer } from '@ngrx/store';

// TODO: should we replace all of the IDs stored in JSON just to be safe?
export function metaReducer(reducer: ActionReducer<State>): ActionReducer<State> {
  return (state: State, action: actions.Actions): State => {
    if (action.type === actions.RESET_WORKSPACE) {
      state = undefined;
    }
    state = reducer(state, action);
    if (action.type === actions.RESET_WORKSPACE) {
      const { vectorLayers, animations } = action.payload;
      if (vectorLayers) {
        const { layers } = state;
        state = {
          ...state,
          layers: {
            ...layers,
            vectorLayers,
            activeVectorLayerId: vectorLayers[0].id,
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
