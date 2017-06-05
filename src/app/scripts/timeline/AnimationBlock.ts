import { INTERPOLATORS } from '../interpolators';
import { Path } from '../paths';
import {
  ColorProperty,
  EnumProperty,
  Inspectable,
  NumberProperty,
  PathProperty,
  Property,
} from '../properties';
import * as _ from 'lodash';

/**
 * An animation block is an individual layer property tween (property animation).
 */
@Property.register(
  new NumberProperty('startTime', { min: 0, isInteger: true }),
  new NumberProperty('endTime', { min: 0, isInteger: true }),
  new EnumProperty('interpolator', INTERPOLATORS),
)
export abstract class AnimationBlock {

  constructor(obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.animationId = obj.animationId;
    this.layerId = obj.layerId;
    this.propertyName = obj.propertyName;
    this.startTime = obj.startTime || 0;
    this.endTime = obj.endTime || 100;
    if (this.startTime > this.endTime) {
      const tmp = this.endTime;
      this.endTime = this.startTime;
      this.startTime = tmp;
    }
    this.interpolator = obj.interpolator || INTERPOLATORS[0].value;
    this.fromValue = obj.fromValue;
    this.toValue = obj.toValue;
  }

  isAnimatable() {
    return this.fromValue && this.toValue;
  }

  toJSON() {
    return {
      id: this.id,
      animationId: this.animationId,
      layerId: this.layerId,
      propertyName: this.propertyName,
      startTime: this.startTime,
      endTime: this.endTime,
      interpolator: this.interpolator,
    };
  }

  abstract clone(): AnimationBlock;
}

interface AnimationBlockArgs {
  id?: string;
  animationId: string;
  layerId: string;
  propertyName: string;
  startTime?: number;
  endTime?: number;
  // Stores the 'value' key of the Interpolator object.
  interpolator?: string;
  fromValue: any;
  toValue: any;
}

export interface AnimationBlock extends AnimationBlockArgs, Inspectable { }
export interface ConstructorArgs extends AnimationBlockArgs { }

/**
 * An animation block that animates the 'pathData' property.
 */
@Property.register(
  new PathProperty('fromValue'),
  new PathProperty('toValue'),
)
export class PathAnimationBlock extends AnimationBlock {
  fromValue: Path;
  toValue: Path;

  isAnimatable() {
    return super.isAnimatable() && this.fromValue.isMorphableWith(this.toValue);
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      type: 'path',
      fromValue: this.fromValue.getPathString(),
      toValue: this.toValue.getPathString(),
    });
  }

  clone() {
    return new PathAnimationBlock(this);
  }
}

/**
 * An animation block that animates a color property.
 */
@Property.register(
  new ColorProperty('fromValue'),
  new ColorProperty('toValue'),
)
export class ColorAnimationBlock extends AnimationBlock {
  fromValue: string;
  toValue: string;

  toJSON() {
    return Object.assign(super.toJSON(), {
      type: 'color',
      fromValue: this.fromValue,
      toValue: this.toValue,
    });
  }

  clone() {
    return new ColorAnimationBlock(this);
  }
}

/**
 * An animation block that animates a number property.
 */
@Property.register(
  new NumberProperty('fromValue'),
  new NumberProperty('toValue'),
)
export class NumberAnimationBlock extends AnimationBlock {
  fromValue: number;
  toValue: number;

  toJSON() {
    return Object.assign(super.toJSON(), {
      type: 'number',
      fromValue: this.fromValue,
      toValue: this.toValue,
    });
  }

  clone() {
    return new NumberAnimationBlock(this);
  }
}
