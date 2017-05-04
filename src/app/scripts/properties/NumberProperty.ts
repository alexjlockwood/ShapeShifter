import { Property } from './Property';
import { MathUtil } from '../common';
import { Config } from './Property';

export class NumberProperty extends Property<number> {
  private readonly min: number;
  private readonly max: number;
  private readonly integer: boolean;

  constructor(
    readonly name: string,
    readonly config: NumberConfig = {},
  ) {
    super(name, config);
    this.min = config.min;
    this.max = config.max;
    this.integer = !!config.integer;
  }

  // @Override
  trySetEditedValue(obj: any, propertyName: string, value: number) {
    if (!isNaN(value)) {
      if (this.min !== undefined) {
        value = Math.max(this.min, value);
      }
      if (this.max !== undefined) {
        value = Math.min(this.max, value);
      }
      if (this.integer) {
        value = Math.floor(value);
      }
      obj[propertyName] = value;
    }
  }

  // @Override
  displayValueForValue(value: number) {
    return (Number.isInteger(value)
      ? value.toString()
      : Number(value.toFixed(3)).toString()).replace(/-/g, '\u2212');
  }

  // @Override
  setter_(obj: any, propertyName: string, value: number) {
    if (!isNaN(value)) {
      if (this.min !== undefined) {
        value = Math.max(this.min, value);
      }
      if (this.max !== undefined) {
        value = Math.min(this.max, value);
      }
      if (this.integer) {
        value = Math.floor(value);
      }
    }
    obj[`${propertyName}_`] = value;
  }

  // @Override
  interpolateValue(start: number, end: number, fraction: number) {
    return MathUtil.lerp(start, end, fraction);
  }

  // @Override
  getAnimatorValueType() {
    return 'floatType';
  }
}

export interface NumberConfig extends Config {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}
