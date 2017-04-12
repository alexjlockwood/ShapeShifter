import * as _ from 'lodash';
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { SettingsService } from './settings.service';

const DEFAULT_FRACTION = 0;
const REPEAT_DELAY = 750;
const DEFAULT_IS_SLOW_MOTION = false;
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
  private readonly animatorSettingsSource = new BehaviorSubject<AnimatorSettings>({
    isSlowMotion: DEFAULT_IS_SLOW_MOTION,
    isPlaying: DEFAULT_IS_PLAYING,
    isRepeating: DEFAULT_IS_REPEATING,
  });
  private animator: Animator;

  constructor(
    private readonly ngZone: NgZone,
    private readonly settingsService: SettingsService,
  ) {
    this.animator = new Animator(ngZone, this.settingsService, this.animatorSettingsSource);
  }

  getAnimatedValueObservable() {
    return this.animatedValueSource.asObservable();
  }

  getAnimatorSettingsObservable() {
    return this.animatorSettingsSource.asObservable();
  }

  getAnimatedValue() {
    return this.animatedValueSource.getValue();
  }

  isSlowMotion() {
    return this.animator.isSlowMotion();
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.animator.setIsSlowMotion(isSlowMotion);
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

  reset() {
    this.rewind();
    this.animatorSettingsSource.next({
      isPlaying: false,
      isSlowMotion: false,
      isRepeating: false,
    });
    this.animator = new Animator(this.ngZone, this.settingsService, this.animatorSettingsSource);
  }
}

interface AnimatorSettings {
  isSlowMotion: boolean;
  isPlaying: boolean;
  isRepeating: boolean;
}

class Animator {
  private timeoutId: number;
  private animationFrameId: number;

  private playbackSpeed_ = DEFAULT_IS_SLOW_MOTION ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  private currentAnimatedFraction = 0;
  private shouldPlayInReverse = false;

  constructor(
    private readonly ngZone: NgZone,
    private readonly settingsService,
    private readonly animatorSettingsSource: BehaviorSubject<AnimatorSettings>,
  ) { }

  isPlaying() { return this.animatorSettingsSource.getValue().isPlaying; }

  isRepeating() { return this.animatorSettingsSource.getValue().isRepeating; }

  setIsRepeating(isRepeating: boolean) {
    this.animatorSettingsSource.next(
      _.assign({}, this.animatorSettingsSource.getValue(), { isRepeating }));
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.animatorSettingsSource.next(
      _.assign({}, this.animatorSettingsSource.getValue(), { isSlowMotion }));
    this.playbackSpeed_ = isSlowMotion ? SLOW_MOTION_PLAYBACK_SPEED : DEFAULT_PLAYBACK_SPEED;
  }

  getInterpolator() { return this.settingsService.getInterpolator(); }

  getDuration() { return this.settingsService.getDuration(); }

  isSlowMotion() { return this.animatorSettingsSource.getValue().isSlowMotion; }

  play(onUpdateFn: (fraction: number, value: number) => void) {
    this.startAnimation(onUpdateFn);
    this.animatorSettingsSource.next(
      _.assign({}, this.animatorSettingsSource.getValue(), { isPlaying: true }));
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
    this.animatorSettingsSource.next(
      _.assign({}, this.animatorSettingsSource.getValue(), { isPlaying: false }));
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
    let startTimestamp: number = undefined;
    const onAnimationFrameFn = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      const shouldPlayInReverse = this.shouldPlayInReverse;
      if (progress < (this.getDuration() * this.playbackSpeed_)) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
      } else {
        this.shouldPlayInReverse = !this.shouldPlayInReverse;
        if (this.isRepeating()) {
          this.timeoutId = window.setTimeout(() => {
            this.startAnimation(onUpdateFn);
          }, REPEAT_DELAY);
        } else {
          this.pause();
        }
      }
      const fraction = Math.min(1, progress / (this.getDuration() * this.playbackSpeed_));
      const value = this.getInterpolator().interpolateFn(fraction);
      onUpdateFn(fraction, shouldPlayInReverse ? 1 - value : value);
    };
    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrameFn);
    });
  }
}
