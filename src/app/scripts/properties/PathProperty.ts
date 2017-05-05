import { Path, PathUtil, newPath } from '../paths';
import { Property } from './Property';

export class PathProperty extends Property<Path> {

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
    return newPath(value.getPathString());
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }
}
