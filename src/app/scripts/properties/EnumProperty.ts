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
}

/**
 * The value is the unique string used as a key (and that is stored inside of
 * the model object). The label is what we display in the UI.
 */
export interface Option {
  readonly value: string;
  readonly label: string;
}

// export class EnumProperty extends Property {
//   constructor(name, options = {}, config = {}) {
//     super(name, config);
//     this.optionsByValue_ = {};
//     this.options_ = (options || []).map(option => {
//       let newOption = {};
//       if (typeof option === 'string') {
//         newOption = {
//           value: option,
//           label: option
//         };
//         option = newOption;
//       }

//       if (!('label' in option)) {
//         option.label = option.value;
//       }

//       this.optionsByValue_[option.value] = option;
//       return option;
//     });

//     config = config || {};
//     if (config.storeEntireOption) {
//       this.storeEntireOption = config.storeEntireOption;
//     }
//   }

//   getter_(obj, propertyName, value) {
//     let backingPropertyName = `${propertyName}_`;
//     return obj[backingPropertyName];
//   }

//   setter_(obj, propertyName, value) {
//     let backingPropertyName = `${propertyName}_`;

//     obj[backingPropertyName] = this.storeEntireOption
//         ? this.getOptionForValue_(value)
//         : this.getOptionForValue_(value).value;
//   }

//   getOptionForValue_(value) {
//     if (!value) {
//       return null;
//     }

//     if (typeof value === 'string') {
//       return this.optionsByValue_[value];
//     } else if ('value' in value) {
//       return value;
//     }

//     return null;
//   }

//   displayValueForValue(value) {
//     if (!value) {
//       return '';
//     }

//     return this.getOptionForValue_(value).label;
//   }

//   get options() {
//     return this.options_;
//   }
// }
