import { PointProperty, ValueProperty } from '../properties';

// TODO: ask Hernan what he means by 'the position needs to compensate the pivot value' in his sample bodymovin file
export interface TransformShape {
  /** The shape type. */
  ty: 'tr';
  /** The anchor point. */
  a: PointProperty;
  /** The opacity (default opacity is 100). */
  o: ValueProperty;
  /** The position. */
  p: PointProperty;
  /** The rotation (in degrees). */
  r: ValueProperty;
  /** The scale (default scale is 100). */
  s: PointProperty;
  /** The skew. Always 0. */
  sk: ValueProperty;
  /** The skew angle (in degrees). Always 0. */
  sa: ValueProperty;
}
