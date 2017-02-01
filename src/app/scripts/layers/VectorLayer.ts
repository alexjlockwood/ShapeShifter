import { AbstractLayer } from './AbstractLayer';
import { Layer, GroupLayer, ClipPathLayer, PathLayer } from '.';

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
export class VectorLayer extends AbstractLayer {

  constructor(
    children: Array<GroupLayer | ClipPathLayer | PathLayer>,
    id: string,
    public width = 0,
    public height = 0,
    public alpha = 1,
  ) {
    super(children || [], id);
  }

  clone(): VectorLayer {
    const cloneFn =
      (layer: GroupLayer | ClipPathLayer | PathLayer | VectorLayer) => {
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
        if (layer instanceof ClipPathLayer) {
          return new ClipPathLayer(layer.id, layer.pathData.clone());
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
            layer.trimPathStart,
            layer.trimPathEnd,
            layer.trimPathOffset);
        }
        return new VectorLayer(
          layer.children.map(child => cloneFn(child)),
          layer.id,
          layer.width,
          layer.height,
          layer.alpha);
      };
    return cloneFn(this);
  }
}
