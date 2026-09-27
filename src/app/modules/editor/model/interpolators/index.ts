export {
  CUSTOM_INTERPOLATOR_LABEL,
  findPreset,
  getInterpolateFn,
  getPresetCurve,
  INTERPOLATORS,
  PRESET_CURVES,
  resolveInterpolator,
} from './Interpolator';
export type { Interpolator, ResolvedInterpolator } from './Interpolator';
export {
  createCurveEasing,
  curveToString,
  formatCurveNumber,
  MAX_CURVE_SEGMENTS,
  normalizeCurve,
  parseCurve,
  pointAt,
} from './CustomInterpolator';
export type { Curve, CurveSegment } from './CustomInterpolator';
