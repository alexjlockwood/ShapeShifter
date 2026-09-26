import { Path, PathUtil } from 'app/modules/editor/model/paths';

import { Property } from './Property';

export class PathProperty extends Property<Path | undefined> {
  // @Override
  setEditableValue(model: any, propertyName: string, value: string) {
    let path: Path;
    try {
      path = new Path(value);
    } catch (e) {
      // An error will be thrown if the user attempts to enter an invalid path,
      // which will occur frequently if they type the path out by hand.
      return;
    }
    model[propertyName] = path;
  }

  // @Override
  getEditableValue(model: any, propertyName: string) {
    return model[propertyName] ? model[propertyName].getPathString() : '';
  }

  // @Override
  protected getter(model: any, propertyName: string): Path | undefined {
    return model[`${propertyName}_`];
  }

  // @Override
  protected setter(model: any, propertyName: string, value: Path | string) {
    model[`${propertyName}_`] = toPath(value);
  }

  // @Override
  displayValueForValue(value: Path | undefined) {
    return value ? value.getPathString() : '';
  }

  // @Override
  interpolateValue(start: Path | undefined, end: Path | undefined, fraction: number) {
    if (!start || !end || !start.isMorphableWith(end) || !fraction) {
      return start;
    }
    if (fraction === 1) {
      return end;
    }
    return PathUtil.interpolate(start, end, fraction);
  }

  // @Override
  cloneValue(value: Path | undefined) {
    return value ? value.mutate().build() : undefined;
  }

  // @Override
  getAnimatorValueType() {
    return 'pathType';
  }

  // @Override
  getTypeName() {
    return 'PathProperty';
  }
}

// Files and pasted blocks aren't validated, so this replaces anything that isn't a path (like a
// number, or a string that can't be parsed) with no path. Otherwise the bad value would be stored
// and throw later, while drawing or exporting.
function toPath(value: unknown) {
  if (value instanceof Path) {
    return value;
  }
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  try {
    return new Path(value);
  } catch {
    return undefined;
  }
}
