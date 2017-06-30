import * as actions from './actions';

export interface State {
  readonly isSlowMotion: boolean;
  readonly isPlaying: boolean;
  readonly isRepeating: boolean;
}

export function buildInitialState() {
  return {
    isSlowMotion: false,
    isPlaying: false,
    isRepeating: false,
  } as State;
}

export function reducer(state = buildInitialState(), action: actions.Actions) {
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
