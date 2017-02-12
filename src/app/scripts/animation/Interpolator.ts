import * as BezierEasing from './BezierEasing';

export interface Interpolator {
  readonly value: string;
  readonly label: string;
  readonly interpolateFn: (fraction: number) => number;
  readonly androidRef: string;
}

const FAST_OUT_SLOW_IN_EASING = BezierEasing.create(.4, 0, .2, 1);
const FAST_OUT_LINEAR_IN_EASING = BezierEasing.create(.4, 0, 1, 1);
const LINEAR_OUT_SLOW_IN_EASING = BezierEasing.create(0, 0, .2, 1);

export const INTERPOLATORS: Interpolator[] = [{
    value: 'FAST_OUT_SLOW_IN',
    label: 'Fast out, slow in',
    androidRef: '@android:interpolator/fast_out_slow_in',
    interpolateFn: f => FAST_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'FAST_OUT_LINEAR_IN',
    label: 'Fast out, linear in',
    androidRef: '@android:interpolator/fast_out_linear_in',
    interpolateFn: f => FAST_OUT_LINEAR_IN_EASING(f)
  },
  {
    value: 'LINEAR_OUT_SLOW_IN',
    label: 'Linear out, slow in',
    androidRef: '@android:interpolator/linear_out_slow_in',
    interpolateFn: f => LINEAR_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'ACCELERATE_DECELERATE',
    label: 'Accelerate/decelerate',
    androidRef: '@android:anim/accelerate_decelerate_interpolator',
    interpolateFn: f => Math.cos((f + 1) * Math.PI) / 2.0 + 0.5,
  },
  {
    value: 'ACCELERATE',
    label: 'Accelerate',
    androidRef: '@android:anim/accelerate_interpolator',
    interpolateFn: f => f * f,
  },
  {
    value: 'DECELERATE',
    label: 'Decelerate',
    androidRef: '@android:anim/decelerate_interpolator',
    interpolateFn: f => (1 - (1 - f) * (1 - f)),
  },
  {
    value: 'ANTICIPATE',
    label: 'Anticipate',
    androidRef: '@android:anim/anticipate_interpolator',
    interpolateFn: f => f * f * ((2 + 1) * f - 2),
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    androidRef: '@android:anim/linear_interpolator',
    interpolateFn: f => f,
  },
  {
    value: 'OVERSHOOT',
    label: 'Overshoot',
    androidRef: '@android:anim/overshoot_interpolator',
    interpolateFn: f => (f - 1) * (f - 1) * ((2 + 1) * (f - 1) + 2) + 1
  },
  // TODO: add support for bounce, anticipate overshoot, and path interpolators
];
