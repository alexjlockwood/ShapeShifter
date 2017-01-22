import { Component, Input, Output, EventEmitter, NgZone } from '@angular/core';
import { TimelineService } from './timeline.service';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  public readonly maxAnimationFractionSliderValue = 1000;
  @Input() shouldSnapToGrid: boolean;
  @Input() isMorphable: boolean;
  @Output() labelPointsChangedEmitter = new EventEmitter<boolean>();
  private readonly animationDuration = 1000;

  constructor(
    private timelineService: TimelineService,
    private ngZone: NgZone) { }

  // TODO(alockwood): make this update each time the slider is changed
  onAnimationFractionSliderChanged(sliderValue: number) {
    const fraction = sliderValue / this.maxAnimationFractionSliderValue;
    this.timelineService.setAnimationFraction(fraction);
  }

  onLabelPointsCheckboxChanged(shouldLabelPoints: boolean) {
    this.timelineService.setShouldLabelPoints(shouldLabelPoints);
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
}
