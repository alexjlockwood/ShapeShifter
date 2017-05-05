import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { GroupLayer, ClipPathLayer, PathLayer, Layer } from '.';
import { MathUtil } from '../common';
import {
  Property, NumberProperty, ColorProperty, FractionProperty,
} from '../properties';

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
@Property.register(
  new ColorProperty('canvasColor'),
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

  interpolate(start: VectorLayer, end: VectorLayer, fraction: number) {
    this.alpha = MathUtil.lerp(start.alpha, end.alpha, fraction);
  }

  clone(): VectorLayer {
    const cloneFn =
      (layer: Layer): Layer => {
        if (layer instanceof GroupLayer) {
          return new GroupLayer(
            Object.assign({}, layer, { children: layer.children.map(c => cloneFn(c)) }));
        }
        if (layer instanceof PathLayer) {
          return new PathLayer(
            Object.assign({}, layer, { pathData: layer.pathData.clone() }));
        }
        if (layer instanceof ClipPathLayer) {
          return new ClipPathLayer(
            Object.assign({}, layer, { pathData: layer.pathData.clone() }));
        }
        throw new Error('Unknown layer type');
      };
    return new VectorLayer(
      Object.assign({}, this, { children: this.children.map(c => cloneFn(c)) }));
  }
}

interface VectorLayerArgs {
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends AbstractLayer, VectorLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, VectorLayerArgs { }
