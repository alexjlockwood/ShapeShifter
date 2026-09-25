import { ColorUtil, MathUtil } from 'app/modules/editor/scripts/common';
import _ from 'lodash';

import { Property } from './Property';

export class ColorProperty extends Property<string> {
  // @Override
  protected setter(model: any, propertyName: string, value: string) {
    // Colors are stored as Android color strings, or empty strings for no color. Convert anything
    // else (e.g. an SVG color like 'red' from an older file) so that it can be drawn and animated.
    const isValid = !value || (typeof value === 'string' && !!ColorUtil.parseAndroidColor(value));
    if (!isValid) {
      const color = parseColor(String(value));
      value = color ? ColorUtil.toAndroidString(color) : '';
    }
    super.setter(model, propertyName, value);
  }

  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    const color = value ? parseColor(value) : undefined;
    model[propertyName] = color ? ColorUtil.toAndroidString(color) : undefined;
  }

  // @Override
  interpolateValue(start: string, end: string, f: number) {
    if (!start || !end) {
      return undefined;
    }
    const s = ColorUtil.parseAndroidColor(start);
    const e = ColorUtil.parseAndroidColor(end);
    return ColorUtil.toAndroidString({
      r: _.clamp(Math.round(MathUtil.lerp(s.r, e.r, f)), 0, 0xff),
      g: _.clamp(Math.round(MathUtil.lerp(s.g, e.g, f)), 0, 0xff),
      b: _.clamp(Math.round(MathUtil.lerp(s.b, e.b, f)), 0, 0xff),
      a: _.clamp(Math.round(MathUtil.lerp(s.a, e.a, f)), 0, 0xff),
    });
  }

  // @Override
  getAnimatorValueType() {
    return 'colorType';
  }

  // @Override
  getTypeName() {
    return 'ColorProperty';
  }
}

/** Parses an Android color, or an SVG color (which may be a name like 'red'). */
function parseColor(value: string) {
  const color = ColorUtil.parseAndroidColor(value);
  if (color) {
    return color;
  }
  // This is undefined for 'none'.
  const androidColor = ColorUtil.svgToAndroidColor(value);
  return androidColor ? ColorUtil.parseAndroidColor(androidColor) : undefined;
}
