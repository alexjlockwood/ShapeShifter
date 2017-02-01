import { PathCommand } from '../commands';
import { AbstractLayer } from './AbstractLayer';

/**
 * Model object that mirrors the VectorDrawable's '<path>' element.
 */
export class PathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: PathCommand,
    public fillColor?: string,
    public fillAlpha = 1,
    public strokeColor?: string,
    public strokeAlpha = 1,
    public strokeWidth = 0,
    public strokeLinecap = 'butt',
    public strokeLinejoin = 'miter',
    public strokeMiterLimit = 4,
    // Trim paths are not currently used, but may be useful in the future.
    public trimPathStart = 0,
    public trimPathEnd = 1,
    public trimPathOffset = 0,
  ) {
    super(undefined, id);
  }
}
