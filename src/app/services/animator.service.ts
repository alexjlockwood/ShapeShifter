import { Injectable, NgZone } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { AnimationRenderer } from 'app/scripts/animator';
import { PlaybackService } from 'app/services/playback.service';
import { State, Store } from 'app/store';
import { getAnimatorState } from 'app/store/common/selectors';
import { getIsPlaying, getIsRepeating, getIsSlowMotion } from 'app/store/playback/selectors';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

const DEFAULT_ANIMATOR_EVENT = {
  vl: undefined as VectorLayer,
  currentTime: 0,
};

/**
 * Coordinates and stores information about the currently active animation.
 */
@Injectable()
export class AnimatorService {
  private readonly animatorSubject = new BehaviorSubject(DEFAULT_ANIMATOR_EVENT);
  private animator: Animator;
  private animationRenderer: AnimationRenderer;
  private activeAnimation: Animation;
  private readonly animatorCallback: Callback;

  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
    private readonly playbackService: PlaybackService,
  ) {
    this.animatorCallback = {
      setIsPlaying: (isPlaying: boolean) => {
        this.playbackService.setIsPlaying(isPlaying);
      },
      runOutsideAngular: (fn: () => void) => this.ngZone.runOutsideAngular(fn),
    };
    this.animator = new Animator(this.animatorCallback);
    this.store.select(getIsSlowMotion).subscribe(s => this.animator.setIsSlowMotion(s));
    this.store.select(getIsPlaying).subscribe(p => (p ? this.play() : this.pause()));
    this.store.select(getIsRepeating).subscribe(r => this.animator.setIsRepeating(r));
    this.store.select(getAnimatorState).subscribe(({ vectorLayer: vl, animation }) => {
      this.activeAnimation = animation;
      this.animationRenderer = new AnimationRenderer(vl, animation);
      const currentTime = this.getCurrentTime();
      vl = this.animationRenderer.setAnimationTime(currentTime);
      this.animatorSubject.next({ vl, currentTime });
      this.animator.rewind();
    });
  }

  getCurrentTime() {
    return this.animatorSubject.getValue().currentTime;
  }

  asObservable() {
    return this.animatorSubject.asObservable();
  }

  // TODO: make it possible to pause/resume animations (right now playing resets the time back to 0)
  private play() {
    this.animator.play(this.activeAnimation.duration, fraction => {
      const currentTime = this.activeAnimation.duration * fraction;
      const renderedVectorLayer = this.animationRenderer.setAnimationTime(currentTime);
      if (fraction === 0 || fraction === 1) {
        // Allow change detection at the start/end of the animation.
        this.ngZone.run(() => this.animatorSubject.next({ vl: renderedVectorLayer, currentTime }));
      } else {
        // By default the callback is invoked outside the default Angular
        // zone. Clients receiving this callback should be aware of that.
        this.animatorSubject.next({ vl: renderedVectorLayer, currentTime });
      }
    });
  }

  private pause() {
    this.animator.pause();
  }

  // TODO: make it so rewind navigates to the start of the currently active block?
  rewind() {
    this.animator.rewind();
    const currentTime = 0;
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  // TODO: make it so fast forward navigates to the end of the currently active block?
  fastForward() {
    this.animator.fastForward();
    const currentTime = this.activeAnimation.duration;
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  setAnimationTime(currentTime: number) {
    const vl = this.animationRenderer.setAnimationTime(currentTime);
    this.animatorSubject.next({ vl, currentTime });
  }

  reset() {
    this.rewind();
    this.animator = new Animator(this.animatorCallback);
  }
}

const REPEAT_DELAY = 750;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;

/**
 * A simple class that simulates an animation loop.
 */
class Animator {
  private timeoutId: number;
  private animationFrameId: number;
  private playbackSpeed = DEFAULT_PLAYBACK_SPEED;
  private isRepeating = false;

  // TODO: add the ability to pause/resume animations
  constructor(private readonly callback: Callback) {}

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.playbackSpeed = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  play(duration: number, onUpdateFn: (fraction: number) => void) {
    this.startAnimation(duration, onUpdateFn);
    this.callback.setIsPlaying(true);
  }

  pause() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    this.callback.setIsPlaying(false);
  }

  rewind() {
    this.pause();
  }

  fastForward() {
    this.pause();
  }

  private startAnimation(duration: number, onUpdateFn: (fraction: number) => void) {
    let startTimestamp: number;
    const playbackSpeed = this.playbackSpeed;
    const onAnimationFrameFn = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < duration * playbackSpeed) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
      } else if (this.isRepeating) {
        this.timeoutId = window.setTimeout(
          () => this.startAnimation(duration, onUpdateFn),
          REPEAT_DELAY,
        );
      } else {
        this.pause();
      }
      const fraction = Math.min(1, progress / (duration * playbackSpeed));
      onUpdateFn(fraction);
    };
    this.callback.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
    });
  }
}

interface Callback {
  readonly setIsPlaying: (isPlaying: boolean) => void;
  readonly runOutsideAngular: (fn: () => void) => void;
}
