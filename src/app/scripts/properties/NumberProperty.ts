import * as _ from 'lodash';
import { Property, Config } from './Property';
import { MathUtil } from '../common';

export class NumberProperty extends Property<number> {
  private readonly min: number;
  private readonly max: number;
  private readonly isInteger: boolean;

  constructor(
    readonly name: string,
    readonly config: NumberConfig = {},
  ) {
    super(name, config);
    this.min = config.min === undefined ? -Infinity : config.min;
    this.max = config.max === undefined ? Infinity : config.max;
    this.isInteger = !!config.isInteger;
  }

  // @Override
  setEditableValue(model: any, propertyName: string, value) {
    value = parseFloat(value);
    if (isNaN(value)) {
      return;
    }
    value = _.clamp(value, this.min, this.max);
    if (this.isInteger) {
      value = Math.floor(value);
    }
    model[propertyName] = value;
  }

  // @Override
  protected setter_(model: any, propertyName: string, value) {
    if (typeof value === 'string') {
      value = Number(value);
    }
    if (typeof value === 'number') {
      if (!isNaN(value)) {
        value = _.clamp(value, this.min, this.max);
        if (this.isInteger) {
          value = Math.floor(value);
        }
      }
    }
    model[`${propertyName}_`] = value;
  }

  // @Override
  interpolateValue(start: number, end: number, fraction: number) {
    return MathUtil.lerp(start, end, fraction);
  }

  // @Override
  displayValueForValue(value) {
    if (typeof value === 'number') {
      return (Number.isInteger(value)
        ? value.toString()
        : Number(value.toFixed(3)).toString()).replace(/-/g, '\u2212');
    }
    return value;
  }

  // @Override
  getAnimatorValueType() {
    return 'floatType';
  }
}

export interface NumberConfig extends Config {
  isInteger?: boolean;
  min?: number;
  max?: number;
}
