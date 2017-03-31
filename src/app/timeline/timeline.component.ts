import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import {
  AnimatorService,
  LayerStateService,
  MorphabilityStatus,
} from '../services';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineComponent implements OnInit, OnDestroy {
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatusObservable: Observable<MorphabilityStatus>;
  isAnimationSlowMotionObservable: Observable<boolean>;
  isAnimationPlayingObservable: Observable<boolean>;
  isAnimationRepeatingObservable: Observable<boolean>;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly layerStateService: LayerStateService,
    private readonly animatorService: AnimatorService,
  ) { }

  ngOnInit() {
    this.isAnimationSlowMotionObservable =
      this.animatorService.getAnimatorSettingsObservable()
        .map((value: { isSlowMotion: boolean }) => value.isSlowMotion);
    this.isAnimationPlayingObservable =
      this.animatorService.getAnimatorSettingsObservable()
        .map((value: { isPlaying: boolean }) => value.isPlaying);
    this.isAnimationRepeatingObservable =
      this.animatorService.getAnimatorSettingsObservable()
        .map((value: { isRepeating: boolean }) => value.isRepeating);
    this.morphabilityStatusObservable =
      this.layerStateService.getMorphabilityStatusObservable();
    this.subscriptions.push(
      this.layerStateService.getMorphabilityStatusObservable()
        .subscribe(status => {
          if (status !== MorphabilityStatus.Morphable) {
            this.animatorService.rewind();
          }
        }));
    // TODO: pause animations when window becomes inactive?
    // document.addEventListener('visibilitychange', function() {
    //   console.log(document.hidden);
    // });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  isSlowMotion() {
    return this.animatorService.isSlowMotion();
  }

  isRepeating() {
    return this.animatorService.isRepeating();
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.animatorService.setIsSlowMotion(isSlowMotion);
  }

  onPlayPauseButtonClick() {
    this.animatorService.toggle();
  }

  onRewindClick() {
    this.animatorService.rewind();
  }

  onFastForwardClick() {
    this.animatorService.fastForward();
  }

  setIsRepeating(isRepeating: boolean) {
    this.animatorService.setIsRepeating(isRepeating);
  }
}
