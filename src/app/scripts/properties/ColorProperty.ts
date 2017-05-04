import { ColorUtil, MathUtil } from '../common';
import { Property } from './Property';

export class ColorProperty extends Property<string> {

  // @Override
  interpolateValue(start: string, end: string, f: number) {
    const s = ColorUtil.parseAndroidColor(start);
    const e = ColorUtil.parseAndroidColor(end);
    return ColorUtil.toAndroidString({
      r: MathUtil.clamp(Math.round(MathUtil.lerp(s.r, e.r, f)), 0, 0xff),
      g: MathUtil.clamp(Math.round(MathUtil.lerp(s.g, e.g, f)), 0, 0xff),
      b: MathUtil.clamp(Math.round(MathUtil.lerp(s.b, e.b, f)), 0, 0xff),
      a: MathUtil.clamp(Math.round(MathUtil.lerp(s.a, e.a, f)), 0, 0xff)
    });
  }

  // @Override
  trySetEditedValue(obj: any, propertyName: string, value: string) {
    if (!value) {
      obj[propertyName] = undefined;
      return;
    }
    let processedValue = ColorUtil.parseAndroidColor(value);
    if (!processedValue) {
      processedValue = ColorUtil.parseAndroidColor(ColorUtil.svgToAndroidColor(value));
    }
    obj[propertyName] = ColorUtil.toAndroidString(processedValue);
  }

  // @Override
  getAnimatorValueType() {
    return 'colorType';
  }
}
