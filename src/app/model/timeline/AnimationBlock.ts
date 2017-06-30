import { INTERPOLATORS } from 'app/model/interpolators';
import { Path } from 'app/model/paths';
import {
  ColorProperty,
  EnumProperty,
  Inspectable,
  NumberProperty,
  PathProperty,
  Property,
} from 'app/model/properties';
import * as _ from 'lodash';

type AnimationBlockType = 'path' | 'color' | 'number';

/**
 * An animation block is an individual layer property tween (property animation).
 */
@Property.register(
  new NumberProperty('startTime', { min: 0, isInteger: true }),
  new NumberProperty('endTime', { min: 0, isInteger: true }),
  new EnumProperty('interpolator', INTERPOLATORS),
)
export abstract class AnimationBlock {
  static from(obj: ConstructorArgs) {
    switch (obj.type) {
      case 'path':
        return new PathAnimationBlock(obj);
      case 'color':
        return new ColorAnimationBlock(obj);
      case 'number':
        return new NumberAnimationBlock(obj);
      default:
        throw new Error('invalid block type: ' + obj.type);
    }
  }

  protected constructor(obj: ConstructorArgs) {
    this.id = obj.id || _.uniqueId();
    this.layerId = obj.layerId;
    this.propertyName = obj.propertyName;
    this.startTime = obj.startTime || 0;
    this.endTime = obj.endTime || 100;
    if (this.startTime > this.endTime) {
      // TODO: don't let this happen (usually results in behavior that seems weird to users)
      const tmp = this.endTime;
      this.endTime = this.startTime;
      this.startTime = tmp;
    }
    // TODO: use the correct default interpolator for import svg/avd/property input
    this.interpolator = obj.interpolator || INTERPOLATORS[0].value;
    this.fromValue = obj.fromValue;
    this.toValue = obj.toValue;
    this.type = obj.type;
  }

  toJSON() {
    return {
      id: this.id,
      layerId: this.layerId,
      propertyName: this.propertyName,
      startTime: this.startTime,
      endTime: this.endTime,
      interpolator: this.interpolator,
      type: this.type,
      fromValue: this.fromValue,
      toValue: this.toValue,
    };
  }

  clone() {
    return AnimationBlock.from(this);
  }

  abstract isAnimatable(): boolean;
}

/**
 * An animation block that animates the 'pathData' property.
 */
@Property.register(new PathProperty('fromValue'), new PathProperty('toValue'))
export class PathAnimationBlock extends AnimationBlock {
  // @Override
  toJSON() {
    return Object.assign(super.toJSON(), {
      fromValue: this.fromValue ? this.fromValue.getPathString() : '',
      toValue: this.toValue ? this.toValue.getPathString() : '',
    });
  }

  // @Override
  isAnimatable() {
    return !!this.fromValue && !!this.toValue && this.fromValue.isMorphableWith(this.toValue);
  }
}

/**
 * An animation block that animates a color property.
 */
@Property.register(new ColorProperty('fromValue'), new ColorProperty('toValue'))
export class ColorAnimationBlock extends AnimationBlock {
  // @Override
  isAnimatable() {
    // TODO should this be more specific (i.e. check if valid color values?)
    return !!this.fromValue && !!this.toValue;
  }
}

/**
 * An animation block that animates a number property.
 */
@Property.register(new NumberProperty('fromValue'), new NumberProperty('toValue'))
export class NumberAnimationBlock extends AnimationBlock {
  // @Override
  isAnimatable() {
    return _.isFinite(this.fromValue) && _.isFinite(this.toValue);
  }
}

interface AnimationBlockArgs {
  id?: string;
  layerId: string;
  propertyName: string;
  startTime?: number;
  endTime?: number;
  interpolator?: string; // Stores the 'value' key of the Interpolator object.
  fromValue: any;
  toValue: any;
  type: AnimationBlockType;
}

export interface AnimationBlock extends AnimationBlockArgs, Inspectable {}
export interface ConstructorArgs extends AnimationBlockArgs {}

export interface PathAnimationBlock {
  fromValue: Path;
  toValue: Path;
  clone(): PathAnimationBlock;
}

export interface ColorAnimationBlock {
  fromValue: string;
  toValue: string;
  clone(): ColorAnimationBlock;
}

export interface NumberAnimationBlock {
  fromValue: number;
  toValue: number;
  clone(): NumberAnimationBlock;
}
