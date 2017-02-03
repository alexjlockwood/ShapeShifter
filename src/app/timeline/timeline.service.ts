import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

const AUTO_ANIMATE_INTERVAL = 2000;
const ANIMATION_DURATION = 1000;

@Injectable()
export class TimelineService {

  private currentAnimationFraction = 0;
  private readonly animationFractionSource = new BehaviorSubject<number>(0);
  readonly animationFractionStream = this.animationFractionSource.asObservable();
  private shouldLabelPoints = true;
  private readonly shouldLabelPointsSource = new BehaviorSubject<boolean>(true);
  readonly shouldLabelPointsStream = this.shouldLabelPointsSource.asObservable();

  private animationLooper: AnimationLooper;

  constructor(private ngZone: NgZone) { }

  startAutoAnimate() {
    if (!this.animationLooper) {
      this.animationLooper = new AnimationLooper(this.ngZone);
      const timelineService = this;
      this.animationLooper.start((fraction: number) => {
        timelineService.setAnimationFraction(fraction);
      });
    }
  }

  stopAutoAnimate() {
    if (this.animationLooper) {
      this.animationLooper.stop();
      this.animationLooper = undefined;
    }
  }

  /** Returns the current global animation fraction. */
  getAnimationFraction() {
    return this.currentAnimationFraction;
  }

  /** Sets and broadcasts the current global animation fraction. */
  setAnimationFraction(fraction: number) {
    this.currentAnimationFraction = fraction;
    this.notifyAnimationFractionChange();
  }

  /** Broadcasts the current global animation fraction. */
  notifyAnimationFractionChange() {
    this.animationFractionSource.next(this.currentAnimationFraction);
  }

  /**
   * Adds a listener to receive label points setting events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addShouldLabelPointsListener(callback: (shouldLabelPoints: boolean) => void) {
    return this.shouldLabelPointsStream.subscribe(callback);
  }

  /** Returns the current should label points setting. */
  getShouldLabelPoints() {
    return this.shouldLabelPoints;
  }

  /** Sets and broadcasts the should label points setting. */
  setShouldLabelPoints(shouldLabelPoints: boolean) {
    this.shouldLabelPoints = shouldLabelPoints;
    this.notifyShouldLabelPointsChange();
  }

  /** Broadcasts the current should label points setting. */
  notifyShouldLabelPointsChange() {
    this.shouldLabelPointsSource.next(this.shouldLabelPoints);
  }
}

// TODO: use this to notify setting changes instead
export interface TimelineSettings {
  shouldLabelPoints?: boolean;
  shouldSnapToGrid?: boolean;
}

class AnimationLooper {
  private timeoutId: number;
  private intervalId: number;
  private animationFrameId: number;

  constructor(private readonly ngZone: NgZone) { }

  start(onUpdateFn: (fraction: number) => void) {
    let shouldReverse = false;
    this.timeoutId = setTimeout(() => {
      this.intervalId = setInterval(() => {
        this.executeAnimation(ANIMATION_DURATION, shouldReverse, onUpdateFn);
        shouldReverse = !shouldReverse;
      }, AUTO_ANIMATE_INTERVAL);
      this.timeoutId = undefined;
    }, AUTO_ANIMATE_INTERVAL - ANIMATION_DURATION);
  }

  private executeAnimation(
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
