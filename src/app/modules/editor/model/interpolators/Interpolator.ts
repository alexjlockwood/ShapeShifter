import * as BezierEasing from './BezierEasing';
import {
  createCurveEasing,
  type Curve,
  type CurveSegment,
  curveToString,
  parseCurve,
} from './CustomInterpolator';

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
    webRef: 'cubic-bezier(0.4, 0, 1, 1)',
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
];

/** Returns the preset with the given name, or undefined if it isn't one. */
export function findPreset(value: unknown) {
  return INTERPOLATORS.find(i => i.value === value);
}

/** The label the property inspector shows for an interpolator that's a curve. */
export const CUSTOM_INTERPOLATOR_LABEL = 'Custom';

/**
 * Returns the cubic segment that matches a polynomial of degree 3 or less (fn, with derivative
 * dfn) from x0 to x1. Its x runs linearly with t, so the segment's y(x) is exactly the polynomial.
 */
function polynomialSegment(
  fn: (x: number) => number,
  dfn: (x: number) => number,
  x0: number,
  x1: number,
): CurveSegment {
  const h = x1 - x0;
  const y0 = fn(x0);
  const y1 = fn(x1);
  return {
    start: { x: x0, y: y0 },
    cp1: { x: x0 + h / 3, y: y0 + (h * dfn(x0)) / 3 },
    cp2: { x: x0 + (h * 2) / 3, y: y1 - (h * dfn(x1)) / 3 },
    end: { x: x1, y: y1 },
  };
}

function cubicBezierCurve(x1: number, y1: number, x2: number, y2: number): Curve {
  return [
    { start: { x: 0, y: 0 }, cp1: { x: x1, y: y1 }, cp2: { x: x2, y: y2 }, end: { x: 1, y: 1 } },
  ];
}

/**
 * Joins pieces that end and start at almost the same point, and pins the curve's ends to (0, 0)
 * and (1, 1).
 */
function joinSegments(segments: ReadonlyArray<CurveSegment>): Curve {
  return segments.map((s, i) => ({
    ...s,
    start: i === 0 ? { x: 0, y: 0 } : segments[i - 1].end,
    end: i === segments.length - 1 ? { x: 1, y: 1 } : s.end,
  }));
}

function bounceCurve(): Curve {
  // The same pieces as BOUNCE's interpolateFn, in the fraction's units: 8 * (k * f - c)^2 + d.
  const k = 1.1226;
  const pieces = [
    { until: 0.3535, c: 0, d: 0 },
    { until: 0.7408, c: 0.54719, d: 0.7 },
    { until: 0.9644, c: 0.8526, d: 0.9 },
    { until: k, c: 1.0435, d: 0.95 },
  ];
  let x0 = 0;
  return joinSegments(
    pieces.map(({ until, c, d }) => {
      const x1 = until / k;
      const segment = polynomialSegment(
        f => 8 * (k * f - c) ** 2 + d,
        f => 16 * k * (k * f - c),
        x0,
        x1,
      );
      x0 = x1;
      return segment;
    }),
  );
}

/**
 * Each preset as a curve, which the curve editor shows, and starts from once a preset is edited.
 * They're exact, except that ACCELERATE_DECELERATE's cosine is approximated by a cubic, and
 * BOUNCE's pieces are joined where they meet (within about 1e-4).
 */
export const PRESET_CURVES: Readonly<Record<string, Curve>> = {
  FAST_OUT_SLOW_IN: cubicBezierCurve(0.4, 0, 0.2, 1),
  FAST_OUT_LINEAR_IN: cubicBezierCurve(0.4, 0, 1, 1),
  LINEAR_OUT_SLOW_IN: cubicBezierCurve(0, 0, 0.2, 1),
  ACCELERATE_DECELERATE: cubicBezierCurve(0.37, 0, 0.63, 1),
  ACCELERATE: [
    polynomialSegment(
      f => f * f,
      f => 2 * f,
      0,
      1,
    ),
  ],
  DECELERATE: [
    polynomialSegment(
      f => 1 - (1 - f) * (1 - f),
      f => 2 * (1 - f),
      0,
      1,
    ),
  ],
  LINEAR: [
    polynomialSegment(
      f => f,
      () => 1,
      0,
      1,
    ),
  ],
  ANTICIPATE: [
    polynomialSegment(
      f => f * f * (3 * f - 2),
      f => 9 * f * f - 4 * f,
      0,
      1,
    ),
  ],
  OVERSHOOT: [
    polynomialSegment(
      f => (f - 1) * (f - 1) * (3 * (f - 1) + 2) + 1,
      f => 9 * (f - 1) * (f - 1) + 4 * (f - 1),
      0,
      1,
    ),
  ],
  BOUNCE: bounceCurve(),
  ANTICIPATE_OVERSHOOT: joinSegments([
    // 0.5 * a(2f, 3), where a(t, s) = t^2 * ((s + 1) * t - s).
    polynomialSegment(
      f => 2 * f * f * (8 * f - 3),
      f => 48 * f * f - 12 * f,
      0,
      0.5,
    ),
    // 0.5 * (o(2f - 2, 3) + 2), where o(t, s) = t^2 * ((s + 1) * t + s).
    polynomialSegment(
      f => 0.5 * ((2 * f - 2) ** 2 * (4 * (2 * f - 2) + 3) + 2),
      f => 12 * (2 * f - 2) ** 2 + 6 * (2 * f - 2),
      0.5,
      1,
    ),
  ]),
};

/** Returns a preset's curve (see PRESET_CURVES). */
export function getPresetCurve(preset: Interpolator): Curve {
  return PRESET_CURVES[preset.value] ?? PRESET_CURVES[INTERPOLATORS[0].value];
}

/**
 * An animation block's interpolator string, resolved: a preset, or a curve, whose value is then
 * its canonical string (see curveToString).
 */
export type ResolvedInterpolator =
  | {
      readonly type: 'preset';
      readonly preset: Interpolator;
      readonly curve: Curve;
      readonly interpolateFn: (fraction: number) => number;
    }
  | {
      readonly type: 'custom';
      readonly value: string;
      readonly curve: Curve;
      readonly interpolateFn: (fraction: number) => number;
    };

// Bounded, since dragging a curve's handle resolves a new string on every move.
const MAX_CACHED_INTERPOLATORS = 256;
const resolvedInterpolators = new Map<string, ResolvedInterpolator>();

function resolvePreset(preset: Interpolator): ResolvedInterpolator {
  return {
    type: 'preset',
    preset,
    curve: getPresetCurve(preset),
    interpolateFn: preset.interpolateFn,
  };
}

/**
 * Resolves an animation block's interpolator string: a preset's name, or a curve written as
 * pathInterpolator path data (see parseCurve). Anything else, e.g. from a hand-edited file,
 * resolves to the default preset, INTERPOLATORS[0]. The results are cached.
 */
export function resolveInterpolator(value: unknown): ResolvedInterpolator {
  if (typeof value !== 'string') {
    return resolvePreset(INTERPOLATORS[0]);
  }
  const cached = resolvedInterpolators.get(value);
  if (cached) {
    return cached;
  }
  const preset = findPreset(value);
  let resolved: ResolvedInterpolator;
  if (preset) {
    resolved = resolvePreset(preset);
  } else {
    const curve = parseCurve(value);
    resolved = curve
      ? {
          type: 'custom',
          value: curveToString(curve),
          curve,
          interpolateFn: createCurveEasing(curve),
        }
      : resolvePreset(INTERPOLATORS[0]);
  }
  if (resolvedInterpolators.size >= MAX_CACHED_INTERPOLATORS) {
    resolvedInterpolators.clear();
  }
  resolvedInterpolators.set(value, resolved);
  return resolved;
}

/** Returns the easing function for an animation block's interpolator string (cached). */
export function getInterpolateFn(value: unknown) {
  return resolveInterpolator(value).interpolateFn;
}
