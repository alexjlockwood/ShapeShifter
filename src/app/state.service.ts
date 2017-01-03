import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

@Injectable()
export class StateService {
  private readonly timelineSliderSource = new Subject<number>();
  private readonly timelineSliderStream = this.timelineSliderSource.asObservable();
  private readonly timelineCheckboxSource = new Subject<boolean>();
  private readonly timelineCheckboxStream = this.timelineCheckboxSource.asObservable();

  notifyAnimationFractionChanged(animationFraction: number) {
    this.timelineSliderSource.next(animationFraction);
  }

  notifyShouldLabelPointsChanged(isChecked: boolean) {
    this.timelineCheckboxSource.next(isChecked);
  }

  getAnimationFractionChangedSubscription(callback: (nuanmber) => void): Subscription {
    return this.timelineSliderSource.subscribe(callback);
  }

  getShouldLabelPointsChangedSubscription(callback: (boolean) => void): Subscription {
    return this.timelineCheckboxSource.subscribe(callback);
  }
}
