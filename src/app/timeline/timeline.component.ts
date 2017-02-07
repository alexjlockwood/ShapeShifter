import { Component, NgZone, OnInit } from '@angular/core';
import { TimelineService } from './timeline.service';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {
  maxAnimationFractionSliderValue = 1000;
  animationDuration = 300;
  arePathsMorphable = false;
  isSlowMotionActivated = false;
  isPlayActivated = false;
  isRepeatActivated = false;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private timelineService: TimelineService,
    private ngZone: NgZone) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addVectorLayerListener(CanvasType.Start, vl => {
        this.checkAreLayersMorphable();
      }));
    this.subscriptions.push(
      this.layerStateService.addVectorLayerListener(CanvasType.End, vl => {
        this.checkAreLayersMorphable();
      }));
  }

  private checkAreLayersMorphable() {
    const startVl = this.layerStateService.getVectorLayer(CanvasType.Start);
    const endVl = this.layerStateService.getVectorLayer(CanvasType.End);
    if (!startVl || !endVl) {
      this.arePathsMorphable = false;
      return;
    }
    this.arePathsMorphable = startVl.isMorphableWith(endVl);
    if (this.arePathsMorphable) {
      this.timelineService.startAutoAnimate();
    } else {
      this.timelineService.stopAutoAnimate();
    }
  }

  onPlayPauseClick() {
    let startTimestamp = undefined;
    const onAnimationFrame = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < this.animationDuration) {
        this.timelineService.setAnimationFraction(progress / this.animationDuration);
        requestAnimationFrame(onAnimationFrame);
      } else {
        this.timelineService.setAnimationFraction(1);
        startTimestamp = undefined;
      }
    };
    this.ngZone.runOutsideAngular(() => requestAnimationFrame(onAnimationFrame));
  }
}
