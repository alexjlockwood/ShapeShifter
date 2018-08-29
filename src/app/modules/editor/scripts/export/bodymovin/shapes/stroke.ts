import { LineCap, LineJoin } from '../helpers';
import { ColorProperty, ValueProperty } from '../properties';

export interface StrokeShape {
  /** The shape type. */
  ty: 'st';
  /** The stroke color. */
  c: ColorProperty;
  /** The stroke-opacity (default opacity is 100). */
  o: ValueProperty;
  /** The stroke-width. */
  w: ValueProperty;
  /** The stroke line cap. */
  lc: LineCap;
  /** The stroke line join. */
  lj: LineJoin;
  /** The stroke miter limit (only applicable if the stroke line join is 'miter'). */
  ml: number;
}
