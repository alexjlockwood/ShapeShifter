import { AbstractLayer } from './AbstractLayer';
import { Layer } from '.';
import { MathUtil } from '../common';
import { Property, NumberProperty } from '../properties';

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
@Property.register(
  new NumberProperty('rotation', { animatable: true }),
  new NumberProperty('scaleX', { animatable: true }),
  new NumberProperty('scaleY', { animatable: true }),
  new NumberProperty('pivotX', { animatable: true }),
  new NumberProperty('pivotY', { animatable: true }),
  new NumberProperty('translateX', { animatable: true }),
  new NumberProperty('translateY', { animatable: true }),
)
export class GroupLayer extends AbstractLayer {
  constructor(
    readonly children: Layer[],
    readonly id: string,
    public pivotX = 0,
    public pivotY = 0,
    public rotation = 0,
    public scaleX = 1,
    public scaleY = 1,
    public translateX = 0,
    public translateY = 0,
  ) {
    super(children || [], id);
  }

  interpolate(start: GroupLayer, end: GroupLayer, fraction: number) {
    this.pivotX = MathUtil.lerp(start.pivotX, end.pivotX, fraction);
    this.pivotY = MathUtil.lerp(start.pivotY, end.pivotY, fraction);
    this.rotation = MathUtil.lerp(start.rotation, end.rotation, fraction);
    this.scaleX = MathUtil.lerp(start.scaleX, end.scaleX, fraction);
    this.scaleY = MathUtil.lerp(start.scaleY, end.scaleY, fraction);
    this.translateX = MathUtil.lerp(start.translateX, end.translateX, fraction);
    this.translateY = MathUtil.lerp(start.translateY, end.translateY, fraction);
  }
}
