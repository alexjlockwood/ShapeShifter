import { Path, PathUtil, newPath } from '../paths';
import { Property } from './Property';

export class PathProperty extends Property<Path> {

  setEditableValue(model: any, propertyName: string, value: string) {
    if (typeof value !== 'string') {
      throw new TypeError(`value (${value}, ${typeof value}) must have type string`);
    }
    model[propertyName] = newPath(value);
  }

  // @Override
  getEditableValue(model: any, propertyName: string) {
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    return model[propertyName] ? model[propertyName].clone().getPathString() : '';
  }

  // @Override
  protected getter_(model: any, propertyName: string) {
    return model[`${propertyName}_`];
  }

  // @Override
  protected setter_(model: any, propertyName: string, value) {
    let pathData: Path;
    if (value && typeof value === 'string') {
      pathData = newPath(value);
    } else {
      pathData = value;
    }
    model[`${propertyName}_`] = pathData;
  }

  // @Override
  displayValueForValue(value: Path) {
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    return value.clone().getPathString();
  }

  // @Override
  interpolateValue(start: Path, end: Path, fraction: number) {
    return PathUtil.interpolate(start, end, fraction);
  }

  // @Override
  cloneValue(value: Path) {
    return value.clone();
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }
}
