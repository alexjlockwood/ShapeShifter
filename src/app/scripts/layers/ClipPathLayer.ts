import { Path, PathUtil } from '../paths';
import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { Property, PathProperty } from '../properties';
import { Type } from './Layer';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
@Property.register(
  new PathProperty('pathData', { isAnimatable: true }),
)
export class ClipPathLayer extends AbstractLayer {
  constructor(obj: ConstructorArgs) {
    super(obj);
    this.pathData = obj.pathData;
  }

  getType(): Type {
    return 'clippathlayer';
  }

  clone() {
    const clone = Object.assign(Object.create(this), this) as ClipPathLayer;
    // TODO: paths are immutable, so can we avoid the extra clone?
    clone.pathData = this.pathData.clone();
    clone.children = [];
    return clone;
  }

  deepClone() {
    return this.clone();
  }

  interpolate(start: ClipPathLayer, end: ClipPathLayer, fraction: number) {
    this.pathData = PathUtil.interpolate(start.pathData, end.pathData, fraction);
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends AbstractLayer, ClipPathLayerArgs {
  clone(): ClipPathLayer;
}
export interface ConstructorArgs extends AbstractConstructorArgs, ClipPathLayerArgs { }
