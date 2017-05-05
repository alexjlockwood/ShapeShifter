import { Path } from '../paths';
import { Property, PathProperty, ColorProperty, NumberProperty, EnumProperty } from '../properties';
import { Interpolator, INTERPOLATORS } from '.';

/**
 * An animation block is an individual layer property tween (property animation).
 */
@Property.register(
  new NumberProperty('startTime', { min: 0, isInteger: true }),
  new NumberProperty('endTime', { min: 0, isInteger: true }),
  new EnumProperty('interpolator', INTERPOLATORS),
)
export abstract class AnimationBlock<T extends string | number | Path> {

  constructor(obj: ConstructorArgs<T>) {
    this.layerId = obj.layerId || '';
    this.propertyName = obj.propertyName || '';
    this.startTime = obj.startTime || 0;
    this.endTime = obj.endTime || 0;
    if (this.startTime > this.endTime) {
      const tmp = this.endTime;
      this.endTime = this.startTime;
      this.startTime = tmp;
    }
    this.interpolator = obj.interpolator || INTERPOLATORS[0];
  }

  get typeString() {
    return 'block';
  }

  get typeIdPrefix() {
    return 'block';
  }

  get typeIcon() {
    return 'animation_block';
  }
}

interface AnimationBlockArgs<T> {
  layerId: string;
  propertyName: string;
  startTime?: number;
  endTime?: number;
  interpolator?: Interpolator;
  fromValue: T;
  toValue: T;
}

// tslint:disable-next-line
export interface AnimationBlock<T extends string | number | Path> extends AnimationBlockArgs<T> { }

// tslint:disable-next-line
export interface ConstructorArgs<T extends string | number | Path> extends AnimationBlockArgs<T> { }

/**
 * An animation block that animates the 'pathData' property.
 */
@Property.register(
  new PathProperty('fromValue'),
  new PathProperty('toValue'),
)
export class PathAnimationBlock extends AnimationBlock<Path> { }

/**
 * An animation block that animates a color property.
 */
@Property.register(
  new ColorProperty('fromValue'),
  new ColorProperty('toValue'),
)
export class ColorAnimationBlock extends AnimationBlock<string> { }

/**
 * An animation block that animates a number property.
 */
@Property.register(
  new NumberProperty('fromValue'),
  new NumberProperty('toValue'),
)
export class NumberAnimationBlock extends AnimationBlock<number> { }
