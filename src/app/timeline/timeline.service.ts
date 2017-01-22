import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class TimelineService {

  private currentAnimationFraction = 0;
  private readonly animationFractionSource = new BehaviorSubject<number>(0);
  private readonly animationFractionStream = this.animationFractionSource.asObservable();
  private shouldLabelPoints = true;
  private readonly shouldLabelPointsSource = new BehaviorSubject<boolean>(true);
  private readonly shouldLabelPointsStream = this.shouldLabelPointsSource.asObservable();

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
   * Adds a listener to receive animation change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addAnimationFractionListener(callback: (fraction: number) => void) {
    return this.animationFractionStream.subscribe(callback);
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
