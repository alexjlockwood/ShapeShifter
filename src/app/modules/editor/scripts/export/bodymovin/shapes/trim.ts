import { ValueProperty } from '../properties';

export interface TrimShape {
  /** The shape type. */
  ty: 'tm';
  /** The trim path start. */
  s: ValueProperty;
  /** The trim path end. */
  e: ValueProperty;
  /** The trim path offset. */
  o: ValueProperty;
}
