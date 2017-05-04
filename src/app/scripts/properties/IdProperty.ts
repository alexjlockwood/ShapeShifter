import { Property } from './Property';

export class IdProperty extends Property<string> {

  static sanitize(value = '') {
    return value
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  }

  // @Override
  trySetEditedValue(obj: any, propertyName: string, value: string) {
    obj[propertyName] = IdProperty.sanitize(value);
  }
}
