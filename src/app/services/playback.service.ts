import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { State, Store } from 'app/store';
import { SetIsPlaying, SetIsRepeating, SetIsSlowMotion } from 'app/store/playback/actions';
import { getIsPlaying, getIsRepeating, getIsSlowMotion } from 'app/store/playback/selectors';
import { OutputSelector } from 'reselect';

/**
 * A simple service that provides an interface for making playback changes.
 */
@Injectable()
export class PlaybackService {
  constructor(private readonly store: Store<State>) {}

  setIsPlaying(isPlaying: boolean) {
    if (isPlaying !== this.queryStore(getIsPlaying)) {
      this.store.dispatch(new SetIsPlaying(isPlaying));
    }
  }

  toggleIsSlowMotion() {
    this.store.dispatch(new SetIsSlowMotion(!this.queryStore(getIsSlowMotion)));
  }

  toggleIsPlaying() {
    this.store.dispatch(new SetIsPlaying(!this.queryStore(getIsPlaying)));
  }

  toggleIsRepeating() {
    this.store.dispatch(new SetIsRepeating(!this.queryStore(getIsRepeating)));
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store.select(selector).first().subscribe(o => (obj = o));
    return obj;
  }
}
