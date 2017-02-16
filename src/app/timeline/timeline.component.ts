import { Component, OnInit } from '@angular/core';
import { AnimatorService } from '../services/animator.service';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {
  isTimelineEnabled = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private animatorService: AnimatorService) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.getMorphabilityStatusObservable().subscribe(status => {
        this.isTimelineEnabled = status === MorphabilityStatus.Morphable;
        if (!this.isTimelineEnabled) {
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
    if (this.isPlaying()) {
      this.animatorService.pause();
    } else {
      this.animatorService.play();
    }
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
