import { Path, PathUtil, newPath } from '../paths';
import { Property } from './Property';

export class PathProperty extends Property<Path> {

  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    model[propertyName] = newPath(value);
  }

  // @Override
  getEditableValue(model: any, propertyName: string): string {
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    // TODO: avoid cloning this thing every time... or clone it somewhere else...
    return model[propertyName] ? model[propertyName].clone().getPathString() : '';
  }

  // @Override
  protected getter_(model: any, propertyName: string): Path {
    return model[`${propertyName}_`];
  }

  // @Override
  protected setter_(model: any, propertyName: string, value: Path | string) {
    if (!value) {
      model[`${propertyName}_`] = undefined;
      return;
    }
    let pathData: Path;
    if (typeof value === 'string') {
      pathData = newPath(value);
    } else {
      pathData = value;
    }
    model[`${propertyName}_`] = pathData;
  }

  // @Override
  displayValueForValue(value: Path): string {
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
    // TODO: avoid crashes here (maybe make sure value will always be non-null?)
    // TODO: avoid crashes here (maybe make sure value will always be non-null?)
    // TODO: avoid crashes here (maybe make sure value will always be non-null?)
    // TODO: avoid crashes here (maybe make sure value will always be non-null?)
    return value.clone();
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }
}
