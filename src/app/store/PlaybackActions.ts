import { Action } from '@ngrx/store';

// Playback actions.
export const SET_IS_SLOW_MOTION = 'SET_IS_SLOW_MOTION';
export const SET_IS_PLAYING = 'SET_IS_PLAYING';
export const SET_IS_REPEATING = 'SET_IS_REPEATING';
export const TOGGLE_IS_SLOW_MOTION = 'TOGGLE_IS_SLOW_MOTION';
export const TOGGLE_IS_PLAYING = 'TOGGLE_IS_PLAYING';
export const TOGGLE_IS_REPEATING = 'TOGGLE_IS_REPEATING';
export const RESET_PLAYBACK_SETTINGS = 'RESET_PLAYBACK_SETTINGS';

export class SetIsSlowMotion implements Action {
  readonly type = SET_IS_SLOW_MOTION;
  readonly payload: { isSlowMotion: boolean };
  constructor(readonly isSlowMotion: boolean) {
    this.payload = { isSlowMotion };
  }
}

export class SetIsPlaying implements Action {
  readonly type = SET_IS_PLAYING;
  readonly payload: { isPlaying: boolean };
  constructor(readonly isPlaying: boolean) {
    this.payload = { isPlaying };
  }
}

export class SetIsRepeating implements Action {
  readonly type = SET_IS_REPEATING;
  readonly payload: { isRepeating: boolean };
  constructor(readonly isRepeating: boolean) {
    this.payload = { isRepeating };
  }
}

export class ToggleIsSlowMotion implements Action {
  readonly type = TOGGLE_IS_SLOW_MOTION;
}

export class ToggleIsPlaying implements Action {
  readonly type = TOGGLE_IS_PLAYING;
}

export class ToggleIsRepeating implements Action {
  readonly type = TOGGLE_IS_REPEATING;
}


export class ResetPlaybackSettings implements Action {
  readonly type = RESET_PLAYBACK_SETTINGS;
}

export type Actions =
  SetIsSlowMotion
  | SetIsPlaying
  | SetIsRepeating
  | ToggleIsSlowMotion
  | ToggleIsPlaying
  | ToggleIsRepeating
  | ResetPlaybackSettings;
