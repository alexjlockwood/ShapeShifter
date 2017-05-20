import { Path, PathUtil } from '../paths';
import { Property } from './Property';

export class PathProperty extends Property<Path> {

  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    model[propertyName] = new Path(value);
  }

  // @Override
  getEditableValue(model: any, propertyName: string) {
    return model[propertyName] ? model[propertyName].getPathString() : '';
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
      pathData = new Path(value);
    } else {
      pathData = value;
    }
    model[`${propertyName}_`] = pathData;
  }

  // @Override
  displayValueForValue(value: Path) {
    return value.getPathString();
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
