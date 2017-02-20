import { Component, OnInit, OnDestroy } from '@angular/core';
import { AnimatorService } from '../services/animator.service';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit, OnDestroy {
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatusObservable: Observable<MorphabilityStatus>;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly layerStateService: LayerStateService,
    private readonly animatorService: AnimatorService) { }

  ngOnInit() {
    this.morphabilityStatusObservable = this.layerStateService.getMorphabilityStatusObservable();
    this.subscriptions.push(
      this.layerStateService.getMorphabilityStatusObservable().subscribe(status => {
        if (status !== MorphabilityStatus.Morphable) {
          this.animatorService.rewind();
        }
      }));
    // TODO: pause animations when window becomes inactive?
    // document.addEventListener('visibilitychange', function() {
    //   console.log(document.hidden);
    // });
    // TODO: is this necessary to trigger change detection?
    // this.animatorService.animatedValueStream.subscribe((value: number) => { });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  isSlowMotion() {
    return this.animatorService.isSlowMotion();
  }

  isPlaying() {
    return this.animatorService.isPlaying();
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
