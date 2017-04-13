import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import {
  AnimatorService,
  StateService,
  MorphStatus,
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
  readonly MORPH_NONE = MorphStatus.None;
  readonly MORPH_UNMORPHABLE = MorphStatus.Unmorphable;
  readonly MORPH_MORPHABLE = MorphStatus.Morphable;

  morphStatusObservable: Observable<MorphStatus>;
  isAnimationSlowMotionObservable: Observable<boolean>;
  isAnimationPlayingObservable: Observable<boolean>;
  isAnimationRepeatingObservable: Observable<boolean>;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly stateService: StateService,
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
    this.morphStatusObservable =
      this.stateService.getMorphStatusObservable();
    this.subscriptions.push(
      this.stateService.getMorphStatusObservable()
        .subscribe(status => {
          if (status !== MorphStatus.Morphable) {
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

  isSlowMotion() {
    return this.animatorService.isSlowMotion();
  }

  isRepeating() {
    return this.animatorService.isRepeating();
  }
}
