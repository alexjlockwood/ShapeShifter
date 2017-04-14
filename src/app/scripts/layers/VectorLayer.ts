import { AbstractLayer } from './AbstractLayer';
import { GroupLayer, ClipPathLayer, PathLayer } from '.';
import { MathUtil } from '../common';

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
export class VectorLayer extends AbstractLayer {

  constructor(
    readonly children: Array<GroupLayer | ClipPathLayer | PathLayer>,
    readonly id: string,
    public width = 24,
    public height = 24,
    public alpha = 1,
  ) {
    super(children || [], id);
  }

  interpolate(start: VectorLayer, end: VectorLayer, fraction: number) {
    this.alpha = MathUtil.lerp(start.alpha, end.alpha, fraction);
  }

  clone(): VectorLayer {
    const cloneFn =
      (layer: GroupLayer | ClipPathLayer | PathLayer): GroupLayer | ClipPathLayer | PathLayer => {
        if (layer instanceof GroupLayer) {
          return new GroupLayer(
            layer.children.map(child => cloneFn(child)),
            layer.id,
            layer.pivotX,
            layer.pivotY,
            layer.rotation,
            layer.scaleX,
            layer.scaleY,
            layer.translateX,
            layer.translateY);
        }
        if (layer instanceof PathLayer) {
          return new PathLayer(
            layer.id,
            layer.pathData.clone(),
            layer.fillColor,
            layer.fillAlpha,
            layer.strokeColor,
            layer.strokeAlpha,
            layer.strokeWidth,
            layer.strokeLinecap,
            layer.strokeLinejoin,
            layer.strokeMiterLimit,
            layer.fillType,
            layer.trimPathStart,
            layer.trimPathEnd,
            layer.trimPathOffset);
        }
        if (layer instanceof ClipPathLayer) {
          return new ClipPathLayer(layer.id, layer.pathData.clone());
        }
        throw new Error('Unknown layer type');
      };
    return new VectorLayer(
      this.children.map(child => cloneFn(child)),
      this.id,
      this.width,
      this.height,
      this.alpha);
  }
}
