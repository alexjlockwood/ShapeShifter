import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class AnimationService {

  private currentAnimationFraction = 0;
  private readonly animationChangeSource = new BehaviorSubject<number>(0);
  private readonly animationChangeStream = this.animationChangeSource.asObservable();

  /** Returns the current global animation fraction. */
  getAnimationFraction() {
    return this.currentAnimationFraction;
  }

  /** Sets and broadcasts the current global animation fraction. */
  setAnimationFraction(fraction: number) {
    this.currentAnimationFraction = fraction;
    this.notifyChange();
  }

  /** Broadcasts the current global animation fraction. */
  notifyChange() {
    this.animationChangeSource.next(this.currentAnimationFraction);
  }

  /**
   * Adds a listener to receive animation change events. The caller should
   * unsubscribe from the returned subscription object when it is destroyed.
   */
  addListener(callback: (fraction: number) => void) {
    return this.animationChangeStream.subscribe(callback);
  }
}
