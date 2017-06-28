import { Action } from '@ngrx/store';

export const SET_IS_SLOW_MOTION = '__playback__SET_IS_SLOW_MOTION';
export const SET_IS_PLAYING = '__playback__SET_IS_PLAYING';
export const SET_IS_REPEATING = '__playback__SET_IS_REPEATING';

export class SetIsSlowMotion implements Action {
  readonly type = SET_IS_SLOW_MOTION;
  readonly payload: { isSlowMotion: boolean };
  constructor(isSlowMotion: boolean) {
    this.payload = { isSlowMotion };
  }
}

export class SetIsPlaying implements Action {
  readonly type = SET_IS_PLAYING;
  readonly payload: { isPlaying: boolean };
  constructor(isPlaying: boolean) {
    this.payload = { isPlaying };
  }
}

export class SetIsRepeating implements Action {
  readonly type = SET_IS_REPEATING;
  readonly payload: { isRepeating: boolean };
  constructor(isRepeating: boolean) {
    this.payload = { isRepeating };
  }
}

export type Actions = SetIsSlowMotion | SetIsPlaying | SetIsRepeating;
