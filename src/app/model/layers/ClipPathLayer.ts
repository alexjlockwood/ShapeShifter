import { Path } from 'app/model/paths';
import { PathProperty, Property } from 'app/model/properties';

import { MorphableLayer } from '.';
import { ConstructorArgs as AbstractConstructorArgs, AbstractLayer } from './AbstractLayer';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
@Property.register(new PathProperty('pathData', { isAnimatable: true }))
export class ClipPathLayer extends AbstractLayer implements MorphableLayer {
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

  isStroked() {
    // TODO: this may be the case for Android... but does this limit what web/iOS devs can do?
    return false;
  }

  isFilled() {
    return true;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData ? this.pathData.getPathString() : '',
    });
  }
}

interface ClipPathLayerArgs {
  pathData: Path;
}

export interface ClipPathLayer extends AbstractLayer, ClipPathLayerArgs {}
export interface ConstructorArgs extends AbstractConstructorArgs, ClipPathLayerArgs {}
