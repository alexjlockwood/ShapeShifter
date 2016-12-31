import { Component, Output, EventEmitter } from '@angular/core';


@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent {
  private readonly maxAnimationFractionSliderValue = 1000;
  private shouldLabelPoints: boolean = false;
  @Output() labelPointsChangedEmitter = new EventEmitter<boolean>();
  @Output() animationFractionChangedEmitter = new EventEmitter<number>();

  // TODO(alockwood): make this update each time the slider is changed (not just on mouse up)
  onAnimationFractionChanged(sliderValue: number) {
    this.animationFractionChangedEmitter.emit(sliderValue / this.maxAnimationFractionSliderValue);
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.labelPointsChangedEmitter.emit(shouldLabelPoints);
  }
}
