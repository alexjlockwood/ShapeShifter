import { ValueType } from './ValueType';
import { PropertyName } from './PropertyName';

/**
 * An animation target is an individual layer property tween (property animation).
 */
export class AnimationTarget {
  constructor(
    public layerId: string,
    public duration: number,
    public propertyName: PropertyName,
    public valueType: ValueType,
    // TODO: give the below attributes better types
    public valueFrom: any,
    public valueTo: any,
    public interpolator: any) { }
}

