import * as BezierEasing from './BezierEasing';

export interface Interpolator {
  readonly value: string;
  readonly label: string;
  readonly interpolateFn: (fraction: number) => number;
  readonly androidRef: string;
  readonly webRef: string;
}

const FAST_OUT_SLOW_IN_EASING = BezierEasing.create(0.4, 0, 0.2, 1);
const FAST_OUT_LINEAR_IN_EASING = BezierEasing.create(0.4, 0, 1, 1);
const LINEAR_OUT_SLOW_IN_EASING = BezierEasing.create(0, 0, 0.2, 1);

export const INTERPOLATORS: ReadonlyArray<Interpolator> = [
  {
    value: 'FAST_OUT_SLOW_IN',
    label: 'Fast out, slow in',
    androidRef: '@android:interpolator/fast_out_slow_in',
    interpolateFn: f => FAST_OUT_SLOW_IN_EASING(f),
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  {
    value: 'FAST_OUT_LINEAR_IN',
    label: 'Fast out, linear in',
    androidRef: '@android:interpolator/fast_out_linear_in',
    interpolateFn: f => FAST_OUT_LINEAR_IN_EASING(f),
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  {
    value: 'LINEAR_OUT_SLOW_IN',
    label: 'Linear out, slow in',
    androidRef: '@android:interpolator/linear_out_slow_in',
    interpolateFn: f => LINEAR_OUT_SLOW_IN_EASING(f),
    webRef: 'cubic-bezier(0, 0, 0.2, 1)',
  },
  {
    value: 'ACCELERATE_DECELERATE',
    label: 'Accelerate/decelerate',
    androidRef: '@android:anim/accelerate_decelerate_interpolator',
    interpolateFn: f => Math.cos((f + 1) * Math.PI) / 2.0 + 0.5,
    webRef: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  },
  {
    value: 'ACCELERATE',
    label: 'Accelerate',
    androidRef: '@android:anim/accelerate_interpolator',
    interpolateFn: f => f * f,
    webRef: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  },
  {
    value: 'DECELERATE',
    label: 'Decelerate',
    androidRef: '@android:anim/decelerate_interpolator',
    interpolateFn: f => 1 - (1 - f) * (1 - f),
    webRef: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    androidRef: '@android:anim/linear_interpolator',
    interpolateFn: f => f,
    webRef: 'linear',
  },
  {
    value: 'ANTICIPATE',
    label: 'Anticipate',
    androidRef: '@android:anim/anticipate_interpolator',
    interpolateFn: f => f * f * ((2 + 1) * f - 2),
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)', // TODO: support exporting this interpolator!
  },
  {
    value: 'OVERSHOOT',
    label: 'Overshoot',
    androidRef: '@android:anim/overshoot_interpolator',
    interpolateFn: f => (f - 1) * (f - 1) * ((2 + 1) * (f - 1) + 2) + 1,
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)', // TODO: support exporting this interpolator!
  },
  {
    value: 'BOUNCE',
    label: 'Bounce',
    androidRef: '@android:anim/bounce_interpolator',
    interpolateFn: f => {
      const bounceFn = (t: number) => t * t * 8;
      f *= 1.1226;
      if (f < 0.3535) {
        return bounceFn(f);
      } else if (f < 0.7408) {
        return bounceFn(f - 0.54719) + 0.7;
      } else if (f < 0.9644) {
        return bounceFn(f - 0.8526) + 0.9;
      } else {
        return bounceFn(f - 1.0435) + 0.95;
      }
    },
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)', // TODO: support exporting this interpolator!
  },
  {
    value: 'ANTICIPATE_OVERSHOOT',
    label: 'Anticipate overshoot',
    androidRef: '@android:anim/anticipate_overshoot_interpolator',
    interpolateFn: f => {
      const a = (t: number, s: number) => {
        return t * t * ((s + 1) * t - s);
      };
      const o = (t: number, s: number) => {
        return t * t * ((s + 1) * t + s);
      };
      if (f < 0.5) {
        return 0.5 * a(f * 2, 2 * 1.5);
      } else {
        return 0.5 * (o(f * 2 - 2, 2 * 1.5) + 2);
      }
    },
    webRef: 'cubic-bezier(0.4, 0, 0.2, 1)', // TODO: support exporting this interpolator!
  },
  // TODO: add support for custom path interpolators
];
