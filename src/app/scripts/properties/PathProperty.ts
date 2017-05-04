import { Path, PathUtil, newPath } from '../paths';
import { Property } from './Property';

export class PathProperty extends Property<Path> {

  // @Override
  interpolateValue(start: Path, end: Path, fraction: number) {
    return PathUtil.interpolate(start, end, fraction);
  }

  // @Override
  displayValueForValue(value: Path) {
    return value.getPathString();
  }

  // @Override
  getter_(obj: any, propertyName: string) {
    return obj[`${propertyName}_`];
  }

  // @Override
  setter_(obj: any, propertyName: string, value: string | Path) {
    let pathData;
    if (typeof value === 'string') {
      pathData = newPath(value);
    } else {
      pathData = value;
    }
    obj[`${propertyName}_`] = pathData;
  }

  // @Override
  cloneValue(value: Path) {
    return newPath(value.getPathString());
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }
}
