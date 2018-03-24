import { PlaybackActionTypes, PlaybackActions } from './actions';

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

export function reducer(state = buildInitialState(), action: PlaybackActions) {
  switch (action.type) {
    case PlaybackActionTypes.SetIsSlowMotion: {
      return { ...state, isSlowMotion: action.payload.isSlowMotion };
    }
    case PlaybackActionTypes.SetIsPlaying: {
      return { ...state, isPlaying: action.payload.isPlaying };
    }
    case PlaybackActionTypes.SetIsRepeating: {
      return { ...state, isRepeating: action.payload.isRepeating };
    }
  }
  return state;
}
