import { Property } from './Property';

export class NameProperty extends Property<string> {
  static sanitize(value = '') {
    return value
      .toLowerCase()
      .replace(/^\s+|\s+$/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]+/g, '');
  }

  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    model[propertyName] = NameProperty.sanitize(value);
  }

  // @Override
  getTypeName() {
    return 'NameProperty';
  }
}
