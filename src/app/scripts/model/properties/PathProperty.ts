import { Property } from './Property';
import {
  Path,
  PathUtil,
} from 'app/scripts/model/paths';

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
  protected getter(model: any, propertyName: string): Path {
    return model[`${propertyName}_`];
  }

  // @Override
  protected setter(model: any, propertyName: string, value: Path | string) {
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
    return value ? value.getPathString() : '';
  }

  // @Override
  interpolateValue(start: Path, end: Path, fraction: number) {
    if (!start || !end || !start.isMorphableWith(end) || !fraction) {
      return start;
    }
    if (fraction === 1) {
      return end;
    }
    return PathUtil.interpolate(start, end, fraction);
  }

  // @Override
  cloneValue(value: Path) {
    return value ? value.clone() : undefined;
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }
}
