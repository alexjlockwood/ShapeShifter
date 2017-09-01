import { NumberProperty, Property } from 'app/model/properties';
import { MathUtil, Matrix, Rect } from 'app/scripts/common';
import * as _ from 'lodash';

import { Layer, ConstructorArgs as LayerConstructorArgs } from './Layer';

const DEFAULTS = {
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  pivotX: 0,
  pivotY: 0,
  translateX: 0,
  translateY: 0,
};

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
export class GroupLayer extends Layer {
  // @Override
  readonly type = 'group';

  constructor(obj: ConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.pivotX = setterFn(obj.pivotX, DEFAULTS.pivotX);
    this.pivotY = setterFn(obj.pivotY, DEFAULTS.pivotY);
    this.rotation = setterFn(obj.rotation, DEFAULTS.rotation);
    this.scaleX = setterFn(obj.scaleX, DEFAULTS.scaleX);
    this.scaleY = setterFn(obj.scaleY, DEFAULTS.scaleY);
    this.translateX = setterFn(obj.translateX, DEFAULTS.translateX);
    this.translateY = setterFn(obj.translateY, DEFAULTS.translateY);
  }

  // @Override
  get bounds() {
    let bounds: { l: number; t: number; r: number; b: number };
    this.children.forEach(child => {
      const childBounds = child.bounds;
      if (!childBounds) {
        return;
      }
      if (bounds) {
        bounds.l = Math.min(childBounds.l, bounds.l);
        bounds.t = Math.min(childBounds.t, bounds.t);
        bounds.r = Math.max(childBounds.r, bounds.r);
        bounds.b = Math.max(childBounds.b, bounds.b);
      } else {
        bounds = { ...childBounds };
      }
    });
    if (!bounds) {
      return undefined;
    }
    bounds.l -= this.pivotX;
    bounds.t -= this.pivotY;
    bounds.r -= this.pivotX;
    bounds.b -= this.pivotY;
    const transforms = [
      Matrix.scaling(this.scaleX, this.scaleY),
      Matrix.rotation(this.rotation),
      Matrix.translation(this.translateX, this.translateY),
    ];
    const topLeft = MathUtil.transformPoint({ x: bounds.l, y: bounds.t }, ...transforms);
    const bottomRight = MathUtil.transformPoint({ x: bounds.r, y: bounds.b }, ...transforms);
    return {
      l: topLeft.x + this.pivotX,
      t: topLeft.y + this.pivotY,
      r: bottomRight.x + this.pivotX,
      b: bottomRight.y + this.pivotY,
    };
  }

  // @Override
  clone() {
    const clone = new GroupLayer(this);
    clone.children = [...this.children];
    return clone;
  }

  // @Override
  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }

  // @Override
  toJSON() {
    const obj = Object.assign(super.toJSON(), {
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
      children: this.children.map(child => child.toJSON()),
    });
    Object.entries(DEFAULTS).forEach(([key, value]) => {
      if (obj[key] === value) {
        delete obj[key];
      }
    });
    return obj;
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

export interface GroupLayer extends Layer, GroupLayerArgs {}
export interface ConstructorArgs extends LayerConstructorArgs, GroupLayerArgs {}
