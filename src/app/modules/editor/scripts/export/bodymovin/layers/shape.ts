import { Transform } from '../helpers';
import { Shape } from '../shapes';

export interface ShapeLayer {
  /** The layer type. */
  ty: 4;
  /** The layer index. */
  ind: number;
  /** The start time of the layer. Always 0. */
  st: number;
  /** The in point of the animation in frames. Always 0. */
  ip: number;
  /** The out point of the animation in frames. Always `animDurationMillis * framerate / 1000`. */
  op: number;
  /** The layer's transform properties. */
  ks: Transform;
  /** The layer's shapes. */
  shapes: Shape[];
}
