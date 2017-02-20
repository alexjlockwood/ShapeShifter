/**
 * The names of the currently supported animatable properties.
 */
export type PropertyName = 'pathData' | 'rotation';

/**
 * The currently supported animatable value types.
 */
export type ValueType = 'pathType' | 'floatType';

/**
 * An AvdTarget assigns a group of animations to a particular layer in the vector.
 */
export class AvdTarget {
  constructor(
    public readonly layerId: string,
    public readonly animation: AvdAnimation) { }
}

/**
 * An AvdAnimation represents an individual property tween.
 */
export class AvdAnimation {
  constructor(
    public readonly valueFrom: string,
    public readonly valueTo: string,
    public readonly duration: number,
    public readonly interpolator: string,
    public readonly propertyName: PropertyName,
    public readonly valueType: ValueType) { }
}
