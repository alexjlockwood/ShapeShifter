import { Component, NgZone, OnInit } from '@angular/core';
import { TimelineService } from './timeline.service';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { EditorType } from '../EditorType';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {
  maxAnimationFractionSliderValue = 1000;
  animationDuration = 300;
  isMorphable = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private layerStateService: LayerStateService,
    private timelineService: TimelineService,
    private ngZone: NgZone) { }

  ngOnInit() {
    this.subscriptions.push(
      this.layerStateService.addListener(EditorType.Start, vl => {
        const shouldDisplayStartEditor = !!vl;
        if (!vl) {
          return;
        }
        this.checkAreLayersMorphable();
      }));
    this.subscriptions.push(
      this.layerStateService.addListener(EditorType.End, vl => {
        if (!vl) {
          return;
        }
        this.checkAreLayersMorphable();
      }));
  }

  private checkAreLayersMorphable() {
    this.isMorphable =
      this.layerStateService.getLayer(EditorType.Start)
        .isMorphableWith(this.layerStateService.getLayer(EditorType.End));
  }

  get shouldLabelPoints() {
    return this.timelineService.getShouldLabelPoints();
  }

  // TODO(alockwood): make this update each time the slider is changed
  onAnimationFractionSliderChanged(sliderValue: number) {
    const fraction = sliderValue / this.maxAnimationFractionSliderValue;
    this.timelineService.setAnimationFraction(fraction);
  }

  onPlayClick() {
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

  onLabelPointsCheckboxChanged(shouldLabelPoints: boolean) {
    this.timelineService.setShouldLabelPoints(shouldLabelPoints);
  }

  onSnapToGridCheckboxChanged(shouldSnapToGrid: boolean) {
    // TODO: implement this
  }
}
