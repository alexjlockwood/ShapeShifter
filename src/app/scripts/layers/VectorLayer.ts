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
          return new GroupLayer({
            id: layer.id,
            children: layer.children.map(c => cloneFn(c)),
            pivotX: layer.pivotX,
            pivotY: layer.pivotY,
            rotation: layer.rotation,
            scaleX: layer.scaleX,
            scaleY: layer.scaleY,
            translateX: layer.translateX,
            translateY: layer.translateY,
          });
        }
        if (layer instanceof PathLayer) {
          return new PathLayer({
            id: layer.id,
            children: [],
            pathData: layer.pathData.clone(),
            fillColor: layer.fillColor,
            fillAlpha: layer.fillAlpha,
            strokeColor: layer.strokeColor,
            strokeAlpha: layer.strokeAlpha,
            strokeWidth: layer.strokeWidth,
            strokeLinecap: layer.strokeLinecap,
            strokeLinejoin: layer.strokeLinejoin,
            strokeMiterLimit: layer.strokeMiterLimit,
            trimPathStart: layer.trimPathStart,
            trimPathEnd: layer.trimPathEnd,
            trimPathOffset: layer.trimPathOffset,
            fillType: layer.fillType,
          });
        }
        if (layer instanceof ClipPathLayer) {
          return new ClipPathLayer({
            id: layer.id,
            children: [],
            pathData: layer.pathData.clone(),
          });
        }
        throw new Error('Unknown layer type');
      };
    return new VectorLayer({
      id: this.id,
      children: this.children.map(child => cloneFn(child)),
      width: this.width,
      height: this.height,
      alpha: this.alpha,
    });
  }
}

interface VectorLayerArgs {
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends AbstractLayer, VectorLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, VectorLayerArgs { }
