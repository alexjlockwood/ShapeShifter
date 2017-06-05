import { MathUtil, Matrix, Point, Rect } from '../common';
import { NumberProperty, Property } from '../properties';
import { ConstructorArgs as AbstractConstructorArgs, AbstractLayer } from './AbstractLayer';

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
    bounds.l -= this.pivotX;
    bounds.t -= this.pivotY;
    bounds.r -= this.pivotX;
    bounds.b -= this.pivotY;
    const transforms = [
      Matrix.fromScaling(this.scaleX, this.scaleY),
      Matrix.fromRotation(this.rotation),
      Matrix.fromTranslation(this.translateX, this.translateY),
    ];
    const topLeft = MathUtil.transformPoint(new Point(bounds.l, bounds.t), ...transforms);
    const bottomRight = MathUtil.transformPoint(new Point(bounds.r, bounds.b), ...transforms);
    return new Rect(
      topLeft.x + this.pivotX,
      topLeft.y + this.pivotY,
      bottomRight.x + this.pivotX,
      bottomRight.y + this.pivotY,
    );
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
      children: this.children.map(child => child.toJSON()),
    });
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
