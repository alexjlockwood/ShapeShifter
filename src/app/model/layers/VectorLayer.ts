import { ColorProperty, FractionProperty, NumberProperty, Property } from 'app/model/properties';
import { Rect } from 'app/scripts/common';
import * as _ from 'lodash';

import { Layer, ConstructorArgs as LayerConstructorArgs } from './Layer';

const DEFAULTS = {
  canvasColor: '',
  width: 24,
  height: 24,
  alpha: 1,
};

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
@Property.register(
  new ColorProperty('canvasColor'),
  new NumberProperty('width', { isAnimatable: false, min: 1, isInteger: true }),
  new NumberProperty('height', { isAnimatable: false, min: 1, isInteger: true }),
  new FractionProperty('alpha', { isAnimatable: true }),
)
export class VectorLayer extends Layer {
  // @Override
  readonly type = 'vector';

  constructor(obj = { children: [], name: 'vector' } as ConstructorArgs) {
    super(obj);
    const setterFn = (num: number, def: number) => (_.isNil(num) ? def : num);
    this.canvasColor = obj.canvasColor || DEFAULTS.canvasColor;
    this.width = setterFn(obj.width, DEFAULTS.width);
    this.height = setterFn(obj.height, DEFAULTS.height);
    this.alpha = setterFn(obj.alpha, DEFAULTS.alpha);
  }

  // @Override
  get bounds() {
    return { l: 0, t: 0, r: this.width, b: this.height };
  }

  // @Override
  clone() {
    const clone = new VectorLayer(this);
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
      canvasColor: this.canvasColor,
      width: this.width,
      height: this.height,
      alpha: this.alpha,
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

interface VectorLayerArgs {
  canvasColor?: string;
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends Layer, VectorLayerArgs {}
export interface ConstructorArgs extends LayerConstructorArgs, VectorLayerArgs {}
