import {
  State,
  Store,
} from '../store';
import {
  SetIsPlaying,
  SetIsRepeating,
  SetIsSlowMotion,
} from '../store/playback/actions';
import {
  getIsPlaying,
  getIsRepeating,
  getIsSlowMotion,
} from '../store/playback/selectors';
import { Injectable } from '@angular/core';

/**
 * A simple service that provides an interface for making playback changes.
 */
@Injectable()
export class PlaybackService {

  constructor(private readonly store: Store<State>) { }

  setIsPlaying(isPlaying: boolean) {
    this.store.select(getIsPlaying).first().subscribe(curr => {
      if (isPlaying !== curr) {
        this.store.dispatch(new SetIsPlaying(isPlaying));
      }
    });
  }

  toggleIsSlowMotion() {
    this.store.select(getIsSlowMotion).first().subscribe(isSlowMotion => {
      this.store.dispatch(new SetIsSlowMotion(!isSlowMotion));
    });
  }

  toggleIsPlaying() {
    this.store.select(getIsPlaying).first().subscribe(isPlaying => {
      this.store.dispatch(new SetIsPlaying(!isPlaying));
    });
  }

  toggleIsRepeating() {
    this.store.select(getIsRepeating).first().subscribe(isRepeating => {
      this.store.dispatch(new SetIsRepeating(!isRepeating));
    });
  }
}
