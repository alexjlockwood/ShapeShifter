import { Path } from '../paths';
import { PathProperty, Property } from '../properties';
import { ConstructorArgs as AbstractConstructorArgs, AbstractLayer } from './AbstractLayer';

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

  getIconName() {
    return 'clippathlayer';
  }

  getPrefix() {
    return 'mask';
  }

  clone() {
    return new ClipPathLayer(this);
  }

  deepClone() {
    return this.clone();
  }

  getBoundingBox() {
    return this.pathData ? this.pathData.getBoundingBox() : undefined;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData.getPathString(),
    });
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends AbstractLayer, ClipPathLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, ClipPathLayerArgs { }
