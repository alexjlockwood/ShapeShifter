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
    case actions.SET_IS_PLAYING: {
      const { isPlaying } = action.payload;
      return { ...state, isPlaying };
    }
    case actions.TOGGLE_IS_SLOW_MOTION: {
      const isSlowMotion = !state.isSlowMotion;
      return { ...state, isSlowMotion };
    }
    case actions.TOGGLE_IS_PLAYING: {
      const isPlaying = !state.isPlaying;
      return { ...state, isPlaying };
    }
    case actions.TOGGLE_IS_REPEATING: {
      const isRepeating = !state.isRepeating;
      return { ...state, isRepeating };
    }
  }
  return state;
}
