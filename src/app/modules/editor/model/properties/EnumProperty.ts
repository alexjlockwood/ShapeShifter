import _ from 'lodash';

import { Property } from './Property';

export class EnumProperty extends Property<string> {
  constructor(name: string, readonly options: ReadonlyArray<Option>) {
    super(name);
  }

  // @Override
  protected setter(model: any, propertyName: string, value: string) {
    // Replace invalid values (e.g. from an older file) with the first option, which is the
    // default. Otherwise the property inspector can't display them.
    const isValid = this.options.some(o => o.value === value);
    super.setter(model, propertyName, isValid ? value : this.options[0].value);
  }

  // @Override
  displayValueForValue(value: string) {
    const option = _.find(this.options, o => o.value === value);
    return option ? option.label : value;
  }

  // @Override
  getTypeName() {
    return 'EnumProperty';
  }
}

/**
 * The value is the unique string used as a key (and that is stored inside of
 * the model object). The label is what we display in the UI.
 */
export interface Option {
  readonly value: string;
  readonly label: string;
}
