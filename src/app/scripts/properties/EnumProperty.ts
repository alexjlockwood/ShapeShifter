import { Property } from './Property';

export class EnumProperty extends Property<Option> {

  constructor(name: string, public readonly options: ReadonlyArray<Option>) {
    super(name);
  }

  // @Override
  displayValueForValue(value: Option) {
    return value.label;
  }
}

/**
 * Stores a label to display in the UI and its corresponding key.
 */
interface Option {
  readonly key: string;
  readonly label: string;
}
