import { Component, NgZone, OnInit } from '@angular/core';
import { AnimatorService } from '../services/animator.service';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { CanvasType } from '../CanvasType';

const ANIMATION_DURATION = 300;

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
    private animatorService: AnimatorService,
    private ngZone: NgZone) { }

  ngOnInit() {
    // document.addEventListener('visibilitychange', function() {
    //   console.log(document.hidden);
    // });
    this.subscriptions.push(
      this.layerStateService.addListener(CanvasType.Start, event => {
        this.onLayerStateChanged(event.morphabilityStatus);
      }));
    this.subscriptions.push(
      this.layerStateService.addListener(CanvasType.End, event => {
        this.onLayerStateChanged(event.morphabilityStatus);
      }));
    // TODO: is this necessary to trigger change detection?
    // this.animatorService.animationFractionStream.subscribe(() => {});
  }

  private onLayerStateChanged(morphabilityStatus: MorphabilityStatus) {
    const isTimelineEnabled = morphabilityStatus === MorphabilityStatus.Morphable;
    if (this.isTimelineEnabled === isTimelineEnabled) {
      return;
    }
    this.isTimelineEnabled = isTimelineEnabled;
    if (!this.isTimelineEnabled) {
      this.setIsPlaying(false);
    }
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

  setIsPlaying(isPlaying: boolean) {
    this.animatorService.setIsPlaying(isPlaying);
  }

  setIsRepeating(isRepeating: boolean) {
    this.animatorService.setIsRepeating(isRepeating);
  }
}
