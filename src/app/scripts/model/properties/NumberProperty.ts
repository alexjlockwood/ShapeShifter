import { MathUtil } from 'app/scripts/common';
import * as _ from 'lodash';

import { Config, Property } from './Property';

export class NumberProperty extends Property<number> {
  private readonly min: number;
  private readonly max: number;
  private readonly isInteger: boolean;

  constructor(name: string, config: NumberConfig = {}) {
    super(name, config);
    this.min = config.min === undefined ? -Infinity : config.min;
    this.max = config.max === undefined ? Infinity : config.max;
    this.isInteger = !!config.isInteger;
  }

  // @Override
  setEditableValue(model: any, propertyName: string, value: string | number | undefined) {
    if (typeof value !== 'number') {
      value = parseFloat(value);
    }
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
  protected setter(model: any, propertyName: string, value: string | number | undefined) {
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

  // @Override
  getTypeName() {
    return 'NumberProperty';
  }
}

export interface NumberConfig extends Config {
  isInteger?: boolean;
  min?: number;
  max?: number;
}
