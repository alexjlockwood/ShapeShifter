import { Component, Input, Output, EventEmitter, NgZone } from '@angular/core';
import { AnimationService } from '../services/animation.service';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  public readonly maxAnimationFractionSliderValue = 1000;
  @Input() shouldLabelPoints: boolean;
  @Input() isMorphable: boolean;
  @Output() labelPointsChangedEmitter = new EventEmitter<boolean>();
  private readonly animationDuration = 1000;

  constructor(
    private animationService: AnimationService,
    private ngZone: NgZone) { }

  // TODO(alockwood): make this update each time the slider is changed
  onAnimationFractionSliderChanged(sliderValue: number) {
    const fraction = sliderValue / this.maxAnimationFractionSliderValue;
    this.animationService.setAnimationFraction(fraction);
  }

  onLabelPointsCheckboxChanged(shouldLabelPoints: boolean) {
    this.labelPointsChangedEmitter.emit(shouldLabelPoints);
  }

  onPlayClick() {
    let startTimestamp = undefined;
    const onAnimationFrame = (timestamp: number) => {
      if (!startTimestamp) {
        startTimestamp = timestamp;
      }
      const progress = timestamp - startTimestamp;
      if (progress < this.animationDuration) {
        this.animationService.setAnimationFraction(progress / this.animationDuration);
        requestAnimationFrame(onAnimationFrame);
      } else {
        this.animationService.setAnimationFraction(1);
        startTimestamp = undefined;
      }
    };
    this.ngZone.runOutsideAngular(() => requestAnimationFrame(onAnimationFrame));
  }
}
