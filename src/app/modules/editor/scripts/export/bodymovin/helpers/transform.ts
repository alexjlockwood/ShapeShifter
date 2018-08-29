import { PointProperty, ValueProperty } from '../properties';

export interface Transform {
  /** The anchor point. */
  a: PointProperty;
  /** The position. */
  p: PointProperty;
  /** The scale (default scale is 100). */
  s: PointProperty;
  /** The rotation (in degrees). */
  r: ValueProperty;
  /** The opacity (default opacity is 100). */
  o: ValueProperty;
}
