import { AbstractLayer, ConstructorArgs as AbstractConstructorArgs } from './AbstractLayer';
import { MathUtil, Rect, Point } from '../common';
import { Property, NumberProperty, FractionProperty } from '../properties';
import { GroupLayer, PathLayer, LayerUtil } from '.';

/**
 * Model object that mirrors the VectorDrawable's '<vector>' element.
 */
@Property.register(
  // TODO: add 'canvas color' property?
  new NumberProperty('width', { isAnimatable: false, min: 1, isInteger: true }),
  new NumberProperty('height', { isAnimatable: false, min: 1, isInteger: true }),
  new FractionProperty('alpha', { isAnimatable: true }),
)
export class VectorLayer extends AbstractLayer {

  constructor(obj = { children: [], name: 'vector' } as ConstructorArgs) {
    super(obj);
    this.width = obj.width || 24;
    this.height = obj.height || 24;
    this.alpha = obj.alpha || 1;
  }

  getIconName() {
    return 'vectorlayer';
  }

  getPrefix() {
    return 'vector';
  }

  clone() {
    const clone = new VectorLayer(this);
    clone.children = this.children.slice();
    return clone;
  }

  deepClone() {
    const clone = this.clone();
    clone.children = this.children.map(c => c.deepClone());
    return clone;
  }

  getBoundingBox() {
    return new Rect(0, 0, this.width, this.height);
  }
}

interface VectorLayerArgs {
  width?: number;
  height?: number;
  alpha?: number;
}

export interface VectorLayer extends AbstractLayer, VectorLayerArgs { }
export interface ConstructorArgs extends AbstractConstructorArgs, VectorLayerArgs { }
