import { ShapeProperty } from '../properties';

// TODO: confirm the exact values that should be used for the direction 'd' attribute
export interface PathShape {
  /** The shape type. */
  ty: 'sh';
  /** The direction in which the shape is drawn. */
  d: number;
  /** The shape's path data. */
  ks: ShapeProperty;
}
