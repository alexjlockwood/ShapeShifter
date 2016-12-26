import { Component, OnInit } from '@angular/core';
import { StateService } from './../state.service';

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit {

  constructor(private stateService: StateService) { }

  ngOnInit() { }

  // TODO(alockwood): make this update each time the slider is changed (not just on mouse up)
  onSliderChanged(animationFraction: number) {
    this.stateService.timelineChangedSource.next(animationFraction);
  }
}
