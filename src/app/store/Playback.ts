import * as _ from 'lodash';
import { createSelector } from 'reselect';
import * as actions from './PlaybackActions';

export interface State {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}

export const initialState: State = {
  isSlowMotion: false,
  isPlaying: false,
  isRepeating: false,
};

export function reducer(state = initialState, action: actions.Actions): State {
  switch (action.type) {
    case actions.SET_IS_SLOW_MOTION: {
      return setIsSlowMotion(state, action.payload.isSlowMotion);
    }
    case actions.SET_IS_PLAYING: {
      return setIsPlaying(state, action.payload.isPlaying);
    }
    case actions.SET_IS_REPEATING: {
      return setIsRepeating(state, action.payload.isRepeating);
    }
    case actions.TOGGLE_IS_SLOW_MOTION: {
      return setIsSlowMotion(state, !state.isSlowMotion);
    }
    case actions.TOGGLE_IS_PLAYING: {
      return setIsPlaying(state, !state.isPlaying);
    }
    case actions.TOGGLE_IS_REPEATING: {
      return setIsRepeating(state, !state.isRepeating);
    }
    case actions.RESET_PLAYBACK_SETTINGS: {
      return _.isEqual(state, initialState) ? state : initialState;
    }
    default: {
      return state;
    }
  }
}

function setIsSlowMotion(state: State, isSlowMotion: boolean) {
  if (state.isSlowMotion === isSlowMotion) {
    return state;
  }
  return { ...state, isSlowMotion };
}

function setIsPlaying(state: State, isPlaying: boolean) {
  if (state.isPlaying === isPlaying) {
    return state;
  }
  return { ...state, isPlaying };
}

function setIsRepeating(state: State, isRepeating: boolean) {
  if (state.isRepeating === isRepeating) {
    return state;
  }
  return { ...state, isRepeating };
}
