import { NumberProperty, NumberConfig } from './NumberProperty';

export class FractionProperty extends NumberProperty {
  constructor(
    readonly name: string,
    readonly config: NumberConfig,
  ) {
    super(name, Object.assign({}, config, { min: 0, max: 1 }));
  }

  // @Override
  getAnimatorValueType() {
    return 'floatType';
  }
}
