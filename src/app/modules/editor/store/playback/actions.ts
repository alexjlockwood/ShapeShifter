import { Action } from 'app/modules/editor/store';

export enum PlaybackActionTypes {
  SetIsSlowMotion = '__playback__SET_IS_SLOW_MOTION',
  SetIsPlaying = '__playback__SET_IS_PLAYING',
  SetIsRepeating = '__playback__SET_IS_REPEATING',
  SetCurrentTime = '__playback__SET_CURRENT_TIME',
}

export class SetIsSlowMotion implements Action {
  readonly type = PlaybackActionTypes.SetIsSlowMotion;
  readonly payload: { isSlowMotion: boolean };
  constructor(isSlowMotion: boolean) {
    this.payload = { isSlowMotion };
  }
}

export class SetIsPlaying implements Action {
  readonly type = PlaybackActionTypes.SetIsPlaying;
  readonly payload: { isPlaying: boolean };
  constructor(isPlaying: boolean) {
    this.payload = { isPlaying };
  }
}

export class SetIsRepeating implements Action {
  readonly type = PlaybackActionTypes.SetIsRepeating;
  readonly payload: { isRepeating: boolean };
  constructor(isRepeating: boolean) {
    this.payload = { isRepeating };
  }
}

export class SetCurrentTime implements Action {
  readonly type = PlaybackActionTypes.SetCurrentTime;
  readonly payload: { currentTime: number };
  constructor(currentTime: number) {
    this.payload = { currentTime };
  }
}

export type PlaybackActions = SetIsSlowMotion | SetIsPlaying | SetIsRepeating | SetCurrentTime;
