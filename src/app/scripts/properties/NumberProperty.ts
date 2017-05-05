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
  setEditableValue(model: any, propertyName: string, value: number) {
    if (isNaN(value)) {
      return;
    }
    value = _.clamp(value, this.min, this.max);
    if (this.isInteger) {
      value = Math.floor(value);
    }
    super.setEditableValue(model, propertyName, value);
  }

  // TODO: is overriding this necessary? (already being done above?)
  // @Override
  // protected setter_(model: any, propertyName: string, value: number) {
  //   if (isNaN(value)) {
  //     return;
  //   }
  //   value = _.clamp(value, this.min, this.max);
  //   if (this.isInteger) {
  //     value = Math.floor(value);
  //   }
  //   super.setter_(model, propertyName, value);
  // }

  // @Override
  interpolateValue(start: number, end: number, fraction: number) {
    return MathUtil.lerp(start, end, fraction);
  }

  // @Override
  displayValueForValue(val: number) {
    return _.round(val, 3).toString().replace(/-/g, '\u2212');
  }

  // @Override
  getAnimatorValueType() {
    return 'floatType';
  }
}

export interface NumberConfig extends Config {
  readonly min?: number;
  readonly max?: number;
  readonly isInteger?: boolean;
}
