import {
  CUSTOM_INTERPOLATOR_LABEL,
  INTERPOLATORS,
  resolveInterpolator,
} from 'app/modules/editor/model/interpolators';

import { Property } from './Property';

/**
 * An animation block's interpolator: a preset's name (one of INTERPOLATORS' values), or a custom
 * easing curve written as canonical pathInterpolator path data (see parseCurve).
 */
export class InterpolatorProperty extends Property<string> {
  readonly options = INTERPOLATORS;

  // @Override
  protected setter(model: any, propertyName: string, value: string) {
    // Keeps presets, canonicalizes curves, and replaces anything else (e.g. from an older or a
    // hand-edited file) with the default preset, INTERPOLATORS[0].
    const resolved = resolveInterpolator(value);
    super.setter(
      model,
      propertyName,
      resolved.type === 'preset' ? resolved.preset.value : resolved.value,
    );
  }

  // @Override
  displayValueForValue(value: string) {
    const resolved = resolveInterpolator(value);
    return resolved.type === 'preset' ? resolved.preset.label : CUSTOM_INTERPOLATOR_LABEL;
  }

  // @Override
  getTypeName() {
    return 'InterpolatorProperty';
  }
}
