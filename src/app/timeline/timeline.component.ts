import { Component, NgZone, OnInit } from '@angular/core';
import { TimelineService } from '../services/timeline.service';
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
  isSlowMotion = false;
  isPlaying = false;
  isRepeating = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private timelineService: TimelineService,
    private ngZone: NgZone) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addListener(CanvasType.Start, event => {
        this.onLayerStateChanged(event.morphabilityStatus);
      }));
    this.subscriptions.push(
      this.layerStateService.addListener(CanvasType.End, event => {
        this.onLayerStateChanged(event.morphabilityStatus);
      }));
  }

  private onLayerStateChanged(morphabilityStatus: MorphabilityStatus) {
    const isTimelineEnabled = morphabilityStatus === MorphabilityStatus.Morphable;
    if (this.isTimelineEnabled === isTimelineEnabled) {
      return;
    }
    this.isTimelineEnabled = isTimelineEnabled;
    if (this.isTimelineEnabled) {
      // TODO: enable everything and stuff
    } else {
      // TODO: cancel ongoing animations, reset buttons, etc.
    }
  }

  setIsSlowMotion(isSlowMotion: boolean) {
    this.isSlowMotion = isSlowMotion;
  }

  setIsPlaying(isPlaying: boolean) {
    this.isPlaying = isPlaying;
  }

  setIsRepeating(isRepeating: boolean) {
    this.isRepeating = isRepeating;
  }

  onPlayPauseClick() {
    let startTimestamp = undefined;
    const onAnimationFrame = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < ANIMATION_DURATION) {
        this.timelineService.setAnimationFraction(progress / ANIMATION_DURATION);
        requestAnimationFrame(onAnimationFrame);
      } else {
        this.timelineService.setAnimationFraction(1);
        startTimestamp = undefined;
      }
    };
    this.ngZone.runOutsideAngular(() => requestAnimationFrame(onAnimationFrame));
  }
}
