import { FillRule } from '../helpers';
import { ColorProperty, ValueProperty } from '../properties';

export interface FillShape {
  /** The shape type. */
  ty: 'fl';
  /** The fill color. */
  c: ColorProperty;
  /** The fill-opacity (default opacity is 100). */
  o: ValueProperty;
  /** The fill rule. */
  r: FillRule;
}
