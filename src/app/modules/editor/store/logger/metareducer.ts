import type { ActionReducer } from 'app/modules/editor/store';
import { PlaybackActionTypes } from 'app/modules/editor/store/playback/actions';

/**
 * Meta reducer that logs the before/after state of the store as actions are performed.
 */
export function metaReducer<T>(reducer: ActionReducer<T>): ActionReducer<T> {
  return (state, action) => {
    const nextState = reducer(state, action);
    // The current time is updated on every animation frame during playback.
    if (action.type !== PlaybackActionTypes.SetCurrentTime) {
      console.groupCollapsed(action.type);
      console.log('prev state', state);
      console.log('action', action);
      console.log('next state', nextState);
      console.groupEnd();
    }
    return nextState;
  };
}
