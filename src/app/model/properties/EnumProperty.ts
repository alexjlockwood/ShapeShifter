import * as _ from 'lodash';

import { Property } from './Property';

export class EnumProperty extends Property<string> {
  constructor(name: string, public readonly options: ReadonlyArray<Option>) {
    super(name);
  }

  // @Override
  displayValueForValue(value: string) {
    return _.find(this.options, o => o.value === value).label;
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
