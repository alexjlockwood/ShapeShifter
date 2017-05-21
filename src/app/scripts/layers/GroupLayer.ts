import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { MathUtil, Rect } from '../common';
import { Property, NumberProperty } from '../properties';

/**
 * Model object that mirrors the VectorDrawable's '<group>' element.
 */
@Property.register(
  new NumberProperty('rotation', { isAnimatable: true }),
  new NumberProperty('scaleX', { isAnimatable: true }),
  new NumberProperty('scaleY', { isAnimatable: true }),
  new NumberProperty('pivotX', { isAnimatable: true }),
  new NumberProperty('pivotY', { isAnimatable: true }),
  new NumberProperty('translateX', { isAnimatable: true }),
  new NumberProperty('translateY', { isAnimatable: true }),
)
export class GroupLayer extends AbstractLayer {
  constructor(obj: ConstructorArgs) {
    super(obj);
    this.pivotX = obj.pivotX || 0;
    this.pivotY = obj.pivotY || 0;
    this.rotation = obj.rotation || 0;
    this.scaleX = obj.scaleX || 1;
    this.scaleY = obj.scaleY || 1;
    this.translateX = obj.translateX || 0;
    this.translateY = obj.translateY || 0;
  }

  getIconName() {
    return 'grouplayer';
  }

  getPrefix() {
    return 'group';
  }

  clone() {
    const clone = new GroupLayer(this);
    clone.children = this.children.slice();
    return clone;
  }

  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }

  // TODO: remove this and use properties to interpolate values
  interpolate(start: GroupLayer, end: GroupLayer, fraction: number) {
    this.pivotX = MathUtil.lerp(start.pivotX, end.pivotX, fraction);
    this.pivotY = MathUtil.lerp(start.pivotY, end.pivotY, fraction);
    this.rotation = MathUtil.lerp(start.rotation, end.rotation, fraction);
    this.scaleX = MathUtil.lerp(start.scaleX, end.scaleX, fraction);
    this.scaleY = MathUtil.lerp(start.scaleY, end.scaleY, fraction);
    this.translateX = MathUtil.lerp(start.translateX, end.translateX, fraction);
    this.translateY = MathUtil.lerp(start.translateY, end.translateY, fraction);
  }

  getBoundingBox() {
    let bounds: Rect = undefined;
    this.children.forEach(child => {
      const childBounds = child.getBoundingBox();
      if (!childBounds) {
        return;
      }
      if (bounds) {
        bounds.l = Math.min(childBounds.l, bounds.l);
        bounds.t = Math.min(childBounds.t, bounds.t);
        bounds.r = Math.max(childBounds.r, bounds.r);
        bounds.b = Math.max(childBounds.b, bounds.b);
      } else {
        bounds = childBounds.clone();
      }
    });
    return bounds;
  }
}

interface GroupLayerArgs {
  pivotX?: number;
  pivotY?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  translateX?: number;
  translateY?: number;
}

export interface GroupLayer extends AbstractLayer, GroupLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, GroupLayerArgs { }
