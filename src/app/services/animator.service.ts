import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { MathUtil } from '../scripts/common';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';

const DEFAULT_FRACTION = 0;
const DEFAULT_INTERPOLATOR = INTERPOLATORS[0];
const MIN_DURATION = 100;
const DEFAULT_DURATION = 300;
const MAX_DURATION = 60000;
const REPEAT_DELAY = 750;
const DEFAULT_PLAYBACK_SPEED = 1;
const SLOW_MOTION_PLAYBACK_SPEED = 5;
const DEFAULT_IS_REPEATING = false;
const DEFAULT_IS_PLAYING = false;

/**
 * Coordinates and stores information about the currently displayed preview
 * canvas animation.
 * TODO: deal with animation being paused midway through
 */
@Injectable()
export class AnimatorService {
  private readonly animatedValueSource = new BehaviorSubject<number>(DEFAULT_FRACTION);
  private animator: Animator;

  constructor(private readonly ngZone: NgZone) {
    this.animator = new Animator(ngZone);
  }

  getAnimatedValueObservable() {
    return this.animatedValueSource.asObservable();
  }

  isSlowMotion() {
    return this.animator.getPlaybackSpeed() === SLOW_MOTION_PLAYBACK_SPEED;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.animator.setPlaybackSpeed(
      isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED);
  }

  isRepeating() {
    return this.animator.isRepeating();
  }

  setIsRepeating(isRepeating: boolean) {
    this.animator.setIsRepeating(isRepeating);
  }

  isPlaying() {
    return this.animator.isPlaying();
  }

  toggle() {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  private play() {
    this.animator.play((fraction: number, value: number) => {
      if (fraction === 0 || fraction === 1) {
        // Allow change detection at the start/end of the animation.
        this.ngZone.run(() => this.animatedValueSource.next(value));
      } else {
        // By default the callback is invoked outside the default Angular
        // zone. Clients receiving this callback should be aware of that.
        this.animatedValueSource.next(value);
      }
    });
  }

  private pause() {
    this.animator.pause();
  }

  rewind() {
    this.animator.rewind();
    this.animatedValueSource.next(0);
  }

  fastForward() {
    this.animator.fastForward();
    this.animatedValueSource.next(1);
  }

  setDuration(duration: number) {
    // TODO: remove this once we guarantee the values are sanitized in the settings pane
    if (!duration) {
      duration = DEFAULT_DURATION;
    }
    duration = MathUtil.clamp(duration, MIN_DURATION, MAX_DURATION);
    this.animator.setDuration(duration);
  }

  getDuration() {
    return this.animator.getDuration();
  }

  setInterpolator(interpolator: Interpolator) {
    this.animator.setInterpolator(interpolator);
  }

  getInterpolator() {
    return this.animator.getInterpolator();
  }

  reset() {
    this.rewind();
    this.animator = new Animator(this.ngZone);
  }
}

class Animator {
  private timeoutId: number;
  private animationFrameId: number;

  private isPlaying_ = DEFAULT_IS_PLAYING;
  private isRepeating_ = DEFAULT_IS_REPEATING;
  private playbackSpeed_ = DEFAULT_PLAYBACK_SPEED;
  private interpolator_ = DEFAULT_INTERPOLATOR;
  private duration_ = DEFAULT_DURATION;

  private currentAnimatedFraction = 0;
  private shouldPlayInReverse = false;

  constructor(private readonly ngZone: NgZone) { }

  isPlaying() { return this.isPlaying_; }

  isRepeating() { return this.isRepeating_; }

  setIsRepeating(isRepeating: boolean) { this.isRepeating_ = isRepeating; }

  setPlaybackSpeed(playbackSpeed: number) { this.playbackSpeed_ = playbackSpeed; }

  setInterpolator(interpolator: Interpolator) { this.interpolator_ = interpolator; }

  setDuration(duration: number) { this.duration_ = duration; }

  getInterpolator() { return this.interpolator_; }

  getDuration() { return this.duration_; }

  getPlaybackSpeed() { return this.playbackSpeed_; }

  play(onUpdateFn: (fraction: number, value: number) => void) {
    this.isPlaying_ = true;
    this.startAnimation(onUpdateFn);
  }

  pause() {
    this.isPlaying_ = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
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

  private startAnimation(onUpdateFn: (fraction: number, value: number) => void) {
    let startTimestamp = undefined;
    const onAnimationFrame = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      const shouldPlayInReverse = this.shouldPlayInReverse;
      if (progress < (this.duration_ * this.playbackSpeed_)) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrame);
      } else {
        this.shouldPlayInReverse = !this.shouldPlayInReverse;
        if (this.isRepeating_) {
          this.timeoutId = setTimeout(() => {
            this.startAnimation(onUpdateFn);
          }, REPEAT_DELAY);
        } else {
          this.pause();
        }
      }
      const fraction = Math.min(1, progress / (this.duration_ * this.playbackSpeed_));
      const value = this.interpolator_.interpolateFn(fraction);
      onUpdateFn(fraction, shouldPlayInReverse ? 1 - value : value);
    };
    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrame);
    });
  }
}
