import { Path } from 'app/model/paths';
import { PathProperty, Property } from 'app/model/properties';

import { Layer, ConstructorArgs as LayerConstructorArgs } from './Layer';
import { MorphableLayer } from './MorphableLayer';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
@Property.register(new PathProperty('pathData', { isAnimatable: true }))
export class ClipPathLayer extends Layer implements MorphableLayer {
  // @Override
  readonly type = 'mask';

  constructor(obj: ConstructorArgs) {
    super(obj);
    this.pathData = obj.pathData;
  }

  // @Override
  get bounds() {
    return this.pathData ? this.pathData.getBoundingBox() : undefined;
  }

  // @Override
  clone() {
    return new ClipPathLayer(this);
  }

  // @Override
  deepClone() {
    return this.clone();
  }

  // @Override
  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData ? this.pathData.getPathString() : '',
    });
  }

  isStroked() {
    // TODO: this may be the case for Android... but does this limit what web/iOS devs can do?
    return false;
  }

  isFilled() {
    return true;
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends Layer, ClipPathLayerArgs {}
export interface ConstructorArgs extends LayerConstructorArgs, ClipPathLayerArgs {}
