import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { MathUtil } from '../common';
import {
  Property, NumberProperty, ColorProperty, FractionProperty,
} from '../properties';
import { Type } from './Layer';

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
@Property.register(
  new NumberProperty('width', { isAnimatable: false, min: 1, isInteger: true }),
  new NumberProperty('height', { isAnimatable: false, min: 1, isInteger: true }),
  new FractionProperty('alpha', { isAnimatable: true }),
)
export class VectorLayer extends AbstractLayer {

  constructor(obj: ConstructorArgs) {
    super(obj);
    this.width = obj.width || 1;
    this.height = obj.height || 1;
    this.alpha = obj.alpha || 1;
  }

  getType(): Type {
    return 'vectorlayer';
  }

  interpolate(start: VectorLayer, end: VectorLayer, fraction: number) {
    this.alpha = MathUtil.lerp(start.alpha, end.alpha, fraction);
  }

  clone() {
    return new VectorLayer(this);
  }

  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }
}

interface VectorLayerArgs {
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends AbstractLayer, VectorLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, VectorLayerArgs { }
