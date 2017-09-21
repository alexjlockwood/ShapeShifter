import * as actions from './actions';

export interface State {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}

export function buildInitialState(): State {
  return {
    isSlowMotion: false,
    isPlaying: false,
    isRepeating: false,
  };
}

export function reducer(state = buildInitialState(), action: actions.Actions): State {
  switch (action.type) {
    case actions.SET_IS_SLOW_MOTION: {
      return { ...state, isSlowMotion: action.payload.isSlowMotion };
    }
    case actions.SET_IS_PLAYING: {
      return { ...state, isPlaying: action.payload.isPlaying };
    }
    case actions.SET_IS_REPEATING: {
      return { ...state, isRepeating: action.payload.isRepeating };
    }
  }
  return state;
}
