import { Component, OnInit } from '@angular/core';
import { MdInputDirective } from '@angular/material';
import { BezierEasing } from '../scripts/common';
import { AnimatorService } from '../services/animator.service';

interface Interpolator {
  value: string;
  label: string;
  androidRef: string;
  interpolate: (f: number) => number;
}

const FAST_OUT_SLOW_IN_EASING = BezierEasing.create(.4, 0, .2, 1);
const FAST_OUT_LINEAR_IN_EASING = BezierEasing.create(.4, 0, 1, 1);
const LINEAR_OUT_SLOW_IN_EASING = BezierEasing.create(0, 0, .2, 1);
const INTERPOLATOR_OPTIONS: Interpolator[] = [
  {
    value: 'FAST_OUT_SLOW_IN',
    label: 'Fast out, slow in',
    androidRef: '@android:interpolator/fast_out_slow_in',
    interpolate: f => FAST_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'FAST_OUT_LINEAR_IN',
    label: 'Fast out, linear in',
    androidRef: '@android:interpolator/fast_out_linear_in',
    interpolate: f => FAST_OUT_LINEAR_IN_EASING(f)
  },
  {
    value: 'LINEAR_OUT_SLOW_IN',
    label: 'Linear out, slow in',
    androidRef: '@android:interpolator/linear_out_slow_in',
    interpolate: f => LINEAR_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'ACCELERATE_DECELERATE',
    label: 'Accelerate/decelerate',
    androidRef: '@android:anim/accelerate_decelerate_interpolator',
    interpolate: f => Math.cos((f + 1) * Math.PI) / 2.0 + 0.5,
  },
  {
    value: 'ACCELERATE',
    label: 'Accelerate',
    androidRef: '@android:anim/accelerate_interpolator',
    interpolate: f => f * f,
  },
  {
    value: 'DECELERATE',
    label: 'Decelerate',
    androidRef: '@android:anim/decelerate_interpolator',
    interpolate: f => (1 - (1 - f) * (1 - f)),
  },
  {
    value: 'ANTICIPATE',
    label: 'Anticipate',
    androidRef: '@android:anim/anticipate_interpolator',
    interpolate: f => f * f * ((2 + 1) * f - 2),
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    androidRef: '@android:anim/linear_interpolator',
    interpolate: f => f,
  },
  {
    value: 'OVERSHOOT',
    label: 'Overshoot',
    androidRef: '@android:anim/overshoot_interpolator',
    interpolate: f => (f - 1) * (f - 1) * ((2 + 1) * (f - 1) + 2) + 1
  },
  // TODO: add support for bounce, anticipate overshoot, and path interpolators
];

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  interpolators = INTERPOLATOR_OPTIONS;
  private selectedInterpolator_ = INTERPOLATOR_OPTIONS[0];
  private duration_ = 300;

  constructor(private animatorService: AnimatorService) { }

  ngOnInit() { }

  get selectedInterpolator() {
    return this.selectedInterpolator_;
  }

  set selectedInterpolator(interpolator: Interpolator) {
    this.selectedInterpolator_ = interpolator;
    this.animatorService.setInterpolator(interpolator.interpolate);
  }

  get duration() {
    return this.duration_;
  }

  // TODO: validate this input (i.e. between min/max values)
  set duration(duration: number) {
    this.duration_ = duration;
    this.animatorService.setDuration(duration);
  }

  isPlaying() {
    return this.animatorService.isPlaying();
  }
}
