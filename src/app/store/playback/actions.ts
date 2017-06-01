import { Action } from '@ngrx/store';

export const SET_IS_SLOW_MOTION = '__playback__SET_IS_SLOW_MOTION';
export const SET_IS_PLAYING = '__playback__SET_IS_PLAYING';
export const SET_IS_REPEATING = '__playback__SET_IS_REPEATING';
export const TOGGLE_IS_SLOW_MOTION = '__playback__TOGGLE_IS_SLOW_MOTION';
export const TOGGLE_IS_PLAYING = '__playback__TOGGLE_IS_PLAYING';
export const TOGGLE_IS_REPEATING = '__playback__TOGGLE_IS_REPEATING';

export class SetIsPlaying implements Action {
  readonly type = SET_IS_PLAYING;
  readonly payload: { isPlaying: boolean };
  constructor(readonly isPlaying: boolean) {
    this.payload = { isPlaying };
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

export type Actions =
  SetIsPlaying
  | ToggleIsSlowMotion
  | ToggleIsPlaying
  | ToggleIsRepeating;
