/**
 * An animation target is an individual layer property tween (property animation).
 */
export class AnimationTarget {
  constructor(
    public layerId: string,
    public valueFrom: string,
    public valueTo: string,
    public duration = 1000,
    public interpolator = '@android:anim/accelerate_decelerate_interpolator',
    public propertyName = 'pathData',
    public valueType = 'pathType') { }
}

