import { NumberConfig, NumberProperty } from './NumberProperty';

export class FractionProperty extends NumberProperty {
  constructor(name: string, config: NumberConfig = {}) {
    super(name, {
      isAnimatable: config.isAnimatable,
      min: 0,
      max: 1,
      isInteger: false,
    });
  }

  // @Override
  getAnimatorValueType() {
    return 'floatType';
  }

  // @Override
  getTypeName() {
    return 'FractionProperty';
  }
}
