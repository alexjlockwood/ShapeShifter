import { Interpolator } from '.';

export type PropertyName = 'pathData' | 'rotation';

export type ValueType = 'pathType' | 'floatType';

export class AvdTarget {
  constructor(
    public readonly layerId: string,
    public readonly valueFrom: string,
    public readonly valueTo: string,
    public readonly duration: number,
    public readonly interpolator: string,
    public readonly propertyName: PropertyName,
    public readonly valueType: ValueType) { }
}

