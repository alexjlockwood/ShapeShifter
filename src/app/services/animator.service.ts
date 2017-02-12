import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { MathUtil } from '../scripts/common';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';

const DEFAULT_INTERPOLATOR = INTERPOLATORS[0];
const MIN_DURATION = 100;
const DEFAULT_DURATION = 300;
const MAX_DURATION = 60000;
const REPEAT_DELAY = 1000;
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
  private readonly animatedValueSource = new BehaviorSubject<number>(0);
  readonly animatedValueStream = this.animatedValueSource.asObservable();
  private readonly animator: Animator;
  private isSlowMotion_ = false;

  constructor(private ngZone: NgZone) {
    this.animator = new Animator(ngZone);
  }

  isSlowMotion() {
    return this.isSlowMotion_;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.isSlowMotion_ = isSlowMotion;
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

  play() {
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

  pause() {
    this.animator.pause();
  }

  rewind() {
    this.animator.pause();
    this.animatedValueSource.next(0);
  }

  fastForward() {
    this.animator.pause();
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
