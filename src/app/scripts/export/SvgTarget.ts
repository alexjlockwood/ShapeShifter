/**
 * The names of the currently supported animatable properties.
 */
export type SvgPropertyName =
  'd'
  | 'transform'
  | 'transform-origin'
  | 'fill'
  | 'stroke'
  | 'fill-opacity'
  | 'stroke-opacity'
  | 'stroke-width'
  | 'opacity';

/**
 * An SvgTarget assigns a group of animations to a particular layer in the vector.
 */
export class SvgTarget {
  constructor(
    public readonly layerId: string,
    public readonly animations: SvgAnimation[]) { }
}

/**
 * An SvgAnimation represents an individual property tween.
 */
export class SvgAnimation {
  constructor(
    public readonly valueFrom: string,
    public readonly valueTo: string,
    public readonly duration: number,
    public readonly interpolator: string,
    public readonly propertyName: SvgPropertyName) { }
}
