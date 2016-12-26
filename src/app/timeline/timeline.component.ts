import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {
  private readonly maxAnimationFractionSliderValue = 1000;

  constructor(private stateService: StateService) { }

  ngOnInit() { }

  // TODO(alockwood): make this update each time the slider is changed (not just on mouse up)
  onAnimationFractionChanged(sliderValue: number) {
    this.stateService.notifyAnimationFractionChanged(sliderValue / this.maxAnimationFractionSliderValue);
  }

  onLabelPointsChanged(shouldLabelPoints: boolean) {
    this.stateService.notifyShouldLabelPointsChanged(shouldLabelPoints);
  }
}
