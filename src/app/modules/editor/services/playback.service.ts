import { Injectable, NgZone } from '@angular/core';
import { Action, State, Store } from 'app/modules/editor/store';
import { BatchAction } from 'app/modules/editor/store/batch/actions';
import {
  SetCurrentTime,
  SetIsPlaying,
  SetIsRepeating,
  SetIsSlowMotion,
} from 'app/modules/editor/store/playback/actions';
import {
  getAnimatedVectorLayer,
  getCurrentTime,
  getIsPlaying,
  getIsRepeating,
  getIsSlowMotion,
} from 'app/modules/editor/store/playback/selectors';
import { getAnimation } from 'app/modules/editor/store/timeline/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';
import { first } from 'rxjs/operators';

/** A simple service that provides an interface for making playback changes. */
@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly animator: Animator;

  // TODO: set current time to 0 when animation/vector layer changes (like before)?
  // TODO: reset time (or any other special handling) during workspace resets?
  constructor(private readonly store: Store<State>, ngZone: NgZone) {
    this.animator = new Animator(ngZone, {
      onAnimationStart: () => {
        this.setIsPlaying(true);
      },
      onAnimationUpdate: (currentTime: number) => {
        currentTime = Math.round(currentTime);
        this.store.dispatch(new SetCurrentTime(currentTime));
      },
      onAnimationEnd: () => {
        this.setIsPlaying(false);
      },
    });
    this.store.select(getIsPlaying).subscribe(isPlaying => {
      if (isPlaying) {
        const { duration } = this.queryStore(getAnimation);
        const currentTime = this.getCurrentTime();
        const startTime = duration === this.getCurrentTime() ? 0 : currentTime;
        this.animator.play(duration, startTime);
      } else {
        this.animator.pause();
      }
    });
    this.store.select(getIsSlowMotion).subscribe(isSlowMotion => {
      this.animator.setIsSlowMotion(isSlowMotion);
    });
    this.store.select(getIsRepeating).subscribe(isRepeating => {
      this.animator.setIsRepeating(isRepeating);
    });
  }

  asObservable() {
    return this.store.select(getAnimatedVectorLayer);
  }

  getCurrentTime() {
    return this.queryStore(getCurrentTime);
  }

  setCurrentTime(currentTime: number) {
    currentTime = Math.round(currentTime);
    if (this.queryStore(getCurrentTime) !== currentTime) {
      this.store.dispatch(new SetCurrentTime(currentTime));
    }
  }

  // TODO: make it so rewind navigates to the start of the currently active block?
  rewind() {
    const actions: Action[] = [];
    if (this.getCurrentTime() !== 0) {
      actions.push(new SetCurrentTime(0));
    }
    if (this.queryStore(getIsPlaying)) {
      actions.push(new SetIsPlaying(false));
    }
    if (actions.length) {
      this.store.dispatch(new BatchAction(...actions));
    }
  }

  // TODO: make it so fast forward navigates to the end of the currently active block?
  fastForward() {
    const actions: Action[] = [];
    const { duration } = this.queryStore(getAnimation);
    if (this.getCurrentTime() !== duration) {
      actions.push(new SetCurrentTime(duration));
    }
    if (this.queryStore(getIsPlaying)) {
      actions.push(new SetIsPlaying(false));
    }
    if (actions.length) {
      this.store.dispatch(new BatchAction(...actions));
    }
  }

  toggleIsSlowMotion() {
    this.store.dispatch(new SetIsSlowMotion(!this.queryStore(getIsSlowMotion)));
  }

  toggleIsRepeating() {
    this.store.dispatch(new SetIsRepeating(!this.queryStore(getIsRepeating)));
  }

  toggleIsPlaying() {
    this.setIsPlaying(!this.queryStore(getIsPlaying));
  }

  private setIsPlaying(isPlaying: boolean) {
    if (isPlaying !== this.queryStore(getIsPlaying)) {
      this.store.dispatch(new SetIsPlaying(isPlaying));
    }
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .pipe(first())
      .subscribe(o => (obj = o));
    return obj;
  }
}

const REPEAT_DELAY = 750;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;

/** A simple class that simulates an animation loop. */
class Animator {
  private timeoutId: number;
  private animationFrameId: number;
  private playbackSpeed = DEFAULT_PLAYBACK_SPEED;
  private isRepeating = false;

  constructor(private readonly ngZone: NgZone, private readonly callback: Callback) {}

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    // TODO: make it possible to change this mid-animation?
    this.playbackSpeed = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  play(duration: number, startTime: number) {
    this.runOutsideAngular(() => this.startAnimation(duration, startTime));
    this.runInsideAngular(() => this.callback.onAnimationStart());
  }

  private startAnimation(duration: number, startTime: number) {
    let startTimestamp: number;
    const playbackSpeed = this.playbackSpeed;
    const onAnimationFrameFn = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp + startTime;
      if (progress < duration * playbackSpeed) {
        this.animationFrameId = window.requestAnimationFrame(onAnimationFrameFn);
      } else if (this.isRepeating) {
        this.timeoutId = window.setTimeout(
          () => this.startAnimation(duration, startTime),
          REPEAT_DELAY,
        );
      } else {
        this.pause(true);
      }
      const fraction = _.clamp(progress / (duration * playbackSpeed), 0, 1);
      const executeFn = () => this.callback.onAnimationUpdate(fraction * duration);
      if (fraction === 0 || fraction === 1) {
        this.runInsideAngular(executeFn);
      } else {
        executeFn();
      }
    };
    this.animationFrameId = window.requestAnimationFrame(onAnimationFrameFn);
  }

  pause(shouldNotify = false) {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.animationFrameId) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    if (shouldNotify) {
      this.runInsideAngular(() => this.callback.onAnimationEnd());
    }
  }

  rewind() {
    this.pause();
  }

  fastForward() {
    this.pause();
  }

  private runInsideAngular(fn: () => void) {
    if (NgZone.isInAngularZone()) {
      fn();
    } else {
      this.ngZone.run(fn);
    }
  }

  private runOutsideAngular(fn: () => void) {
    if (NgZone.isInAngularZone()) {
      this.ngZone.runOutsideAngular(fn);
    } else {
      fn();
    }
  }
}

interface Callback {
  onAnimationStart(): void;
  onAnimationUpdate(currentTime: number): void;
  onAnimationEnd(): void;
}
