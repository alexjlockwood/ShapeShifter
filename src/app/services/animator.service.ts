import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

const REPEAT_DELAY = 2000;
const DEFAULT_DURATION = 1000;
const DEFAULT_PLAYBACK_SPEED = 5;

/**
 * Coordinates and stores information about the currently displayed preview
 * canvas animation.
 */
@Injectable()
export class AnimatorService {
  private currentAnimationFraction = 0;
  private readonly animationFractionSource = new BehaviorSubject<number>(0);
  readonly animationFractionStream = this.animationFractionSource.asObservable();
  private readonly animator: Animator;

  private isSlowMotion_ = false;
  private isPlaying_ = false;
  private isRepeating_ = false;
  private duration = DEFAULT_DURATION;
  private playbackSpeed = 1;

  constructor(private ngZone: NgZone) {
    this.animator = new Animator(ngZone);
  }

  isSlowMotion() {
    return this.isSlowMotion_;
  }

  isPlaying() {
    return this.isPlaying_;
  }

  isRepeating() {
    return this.isRepeating_;
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.isSlowMotion_ = isSlowMotion;
    this.playbackSpeed = isSlowMotion ? DEFAULT_PLAYBACK_SPEED : 1;
  }

  rewind() {  }

  setIsPlaying(isPlaying: boolean) {
    if (this.isPlaying_ !== isPlaying) {
      this.isPlaying_ = isPlaying;
      if (isPlaying) {
        this.animator.start((fraction: number) => {
          this.currentAnimationFraction = fraction;
          if (fraction === 1) {
            this.isPlaying_ = false;
            this.ngZone.run(() => this.animationFractionSource.next(fraction));
          } else {
            this.animationFractionSource.next(this.currentAnimationFraction);
          }
        });
      } else {
        this.animator.stop();
      }
    }
  }

  fastForward() { }

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating_ = isRepeating;
  }

  // startAutoAnimate() {
  //   if (!this.animationLooper) {
  //     this.animationLooper = new Animator(this.ngZone);
  //     const timelineService = this;
  //     this.animationLooper.start((fraction: number) => {
  //       timelineService.setAnimationFraction(fraction);
  //     });
  //   }
  // }

  // stopAutoAnimate() {
  //   if (this.animationLooper) {
  //     this.animationLooper.stop();
  //     this.animationLooper = undefined;
  //   }
  // }
}

class Animator {
  private timeoutId: number;
  private intervalId: number;
  private animationFrameId: number;
  private shouldRepeat = false;

  constructor(private readonly ngZone: NgZone) { }

  repeat(repeat: boolean) {
    this.shouldRepeat = true;
    return this;
  }

  start(onUpdateFn: (fraction: number) => void) {
    if (!this.shouldRepeat) {
      this.startAnimation(DEFAULT_DURATION, false, onUpdateFn);
      return;
    }

    let shouldReverse = false;
    this.timeoutId = setTimeout(() => {
      this.intervalId = setInterval(() => {
        this.startAnimation(DEFAULT_DURATION, shouldReverse, onUpdateFn);
        shouldReverse = !shouldReverse;
      }, REPEAT_DELAY);
      this.timeoutId = undefined;
    }, REPEAT_DELAY - DEFAULT_DURATION);
  }

  private startAnimation(
    duration: number,
    shouldReverse: boolean,
    onUpdateFn: (fraction: number) => void) {

    let startTimestamp = undefined;
    const onAnimationFrame = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      const fraction = Math.min(1, progress / duration);
      onUpdateFn(shouldReverse ? 1 - fraction : fraction);
      if (progress < duration) {
        this.animationFrameId = requestAnimationFrame(onAnimationFrame);
      } else {
        startTimestamp = undefined;
        this.animationFrameId = undefined;
      }
    };
    this.ngZone.runOutsideAngular(() => {
      this.animationFrameId = requestAnimationFrame(onAnimationFrame);
    });
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }
}
