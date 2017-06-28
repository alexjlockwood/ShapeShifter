import { ColorUtil, MathUtil } from 'app/scripts/common';
import * as _ from 'lodash';

import { Property } from './Property';

export class ColorProperty extends Property<string> {
  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    if (!value) {
      model[propertyName] = undefined;
      return;
    }
    let processedValue = ColorUtil.parseAndroidColor(value);
    if (!processedValue) {
      processedValue = ColorUtil.parseAndroidColor(ColorUtil.svgToAndroidColor(value));
    }
    model[propertyName] = ColorUtil.toAndroidString(processedValue);
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
