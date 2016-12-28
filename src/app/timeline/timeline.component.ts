import { Component, AfterViewInit } from '@angular/core';
import { StateService } from './../state.service';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements AfterViewInit {
  private readonly maxAnimationFractionSliderValue = 1000;
  private shouldLabelPoints: boolean = false;

  constructor(private stateService: StateService) { }

  ngAfterViewInit() {
    this.onLabelPointsChanged(this.shouldLabelPoints);
  }

  // TODO(alockwood): make this update each time the slider is changed (not just on mouse up)
  onAnimationFractionChanged(sliderValue: number) {
    this.stateService.notifyAnimationFractionChanged(sliderValue / this.maxAnimationFractionSliderValue);
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.stateService.notifyShouldLabelPointsChanged(shouldLabelPoints);
  }
}
