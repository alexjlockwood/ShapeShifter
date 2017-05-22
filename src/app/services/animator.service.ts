import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import {
  Store,
  State,
  getAnimatorState,
  getIsSlowMotion,
  getIsPlaying,
  getIsRepeating,
  SetIsPlaying,
  ToggleIsSlowMotion,
  ToggleIsPlaying,
  ToggleIsRepeating,
  ResetPlaybackSettings,
} from '../store';
import { Animation, AnimationRenderer } from '../scripts/animations';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

const REPEAT_DELAY = 750;
const DEFAULT_IS_SLOW_MOTION = false;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;
const DEFAULT_ANIMATOR_EVENT = { vl: undefined, currentTime: 0 };

/**
 * Coordinates and stores information about the currently active animation.
 */
@Injectable()
export class AnimatorService {
  private readonly animatorSubject = new BehaviorSubject<AnimatorEvent>(DEFAULT_ANIMATOR_EVENT);
  private animator: Animator;
  private animationRenderer: AnimationRenderer;
  private activeAnimation: Animation;

  // TODO: the 'should reverse' flag below doesn't work anymore... fix or remove?
  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
  ) {
    this.animator = new Animator(ngZone, this.store);
    this.store.select(getIsSlowMotion)
      .subscribe(isSlowMotion => this.animator.setIsSlowMotion(isSlowMotion));
    this.store.select(getIsPlaying)
      .subscribe(isPlaying => isPlaying ? this.play() : this.pause());
    this.store.select(getIsRepeating)
      .subscribe(isRepeating => this.animator.setIsRepeating(isRepeating));
    this.store.select(getAnimatorState)
      .subscribe(({ activeVectorLayer, activeAnimation }) => {
        this.activeAnimation = activeAnimation;
        this.animationRenderer = new AnimationRenderer(activeVectorLayer, activeAnimation);
        // TODO: can we make it possible to modify this data w/o pausing the animation?
        this.animator.pause();
      });
  }

  asObservable() {
    return this.animatorSubject.asObservable();
  }

  toggleIsSlowMotion() {
    this.store.dispatch(new ToggleIsSlowMotion());
  }

  toggleIsRepeating() {
    this.store.dispatch(new ToggleIsRepeating());
  }

  toggle() {
    this.store.dispatch(new ToggleIsPlaying());
  }

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
    this.store.dispatch(new ResetPlaybackSettings());
    this.animator = new Animator(this.ngZone, this.store);
  }
}

class Animator {
  private timeoutId: number;
  private animationFrameId: number;
  private playbackSpeed = DEFAULT_IS_SLOW_MOTION ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  private isRepeating = false;
  private currentAnimatedFraction = 0;
  private shouldPlayInReverse = false;

  constructor(
    private readonly ngZone: NgZone,
    private readonly store: Store<State>,
  ) { }

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.playbackSpeed = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  play(duration: number, onUpdateFn: (fraction: number) => void) {
    this.startAnimation(duration, onUpdateFn);
    this.store.dispatch(new SetIsPlaying(true));
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
    this.store.dispatch(new SetIsPlaying(false));
  }

  rewind() {
    this.pause();
    this.shouldPlayInReverse = false;
    this.currentAnimatedFraction = 0;
  }

  fastForward() {
    this.pause();
    this.shouldPlayInReverse = true;
    this.currentAnimatedFraction = 1;
  }

  private startAnimation(duration: number, onUpdateFn: (fraction: number) => void) {
    let startTimestamp: number = undefined;
    const playbackSpeed = this.playbackSpeed;
    const onAnimationFrameFn = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < (duration * playbackSpeed)) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
      } else {
        this.shouldPlayInReverse = !this.shouldPlayInReverse;
        if (this.isRepeating) {
          this.timeoutId = window.setTimeout(() => {
            this.startAnimation(duration, onUpdateFn);
          }, REPEAT_DELAY);
        } else {
          this.pause();
        }
      }
      const fraction = Math.min(1, progress / (duration * playbackSpeed));
      onUpdateFn(fraction);
    };
    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
    });
  }
}

interface AnimatorEvent {
  readonly vl: VectorLayer;
  readonly currentTime: number;
}
