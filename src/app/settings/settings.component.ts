import { Component, OnInit } from '@angular/core';
import { MdInputDirective } from '@angular/material';
import { AnimatorService } from '../services/animator.service';
import { Interpolator, INTERPOLATORS } from '../scripts/animation';
import { LayerStateService, MorphabilityStatus } from '../services/layerstate.service';
import { CanvasType } from '../CanvasType';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  interpolators = INTERPOLATORS;
  isMorphable = false;

  constructor(
    private animatorService: AnimatorService,
    private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.layerStateService.addListener(CanvasType.Start, event => {
      this.isMorphable = event.morphabilityStatus === MorphabilityStatus.Morphable;
    });
    this.layerStateService.addListener(CanvasType.End, event => {
      this.isMorphable = event.morphabilityStatus === MorphabilityStatus.Morphable;
    });
  }

  get selectedInterpolator() {
    return this.animatorService.getInterpolator();
  }

  set selectedInterpolator(interpolator: Interpolator) {
    this.animatorService.setInterpolator(interpolator);
  }

  get duration() {
    return this.animatorService.getDuration();
  }

  // TODO: validate this input (i.e. between min/max values)
  set duration(duration: number) {
    this.animatorService.setDuration(duration);
  }

  isPlaying() {
    return this.animatorService.isPlaying();
  }
}
