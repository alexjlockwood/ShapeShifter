import { PathCommand } from '../commands';
import { AbstractLayer } from './AbstractLayer';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
export class ClipPathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: PathCommand,
  ) {
    super(undefined, id);
  }

  interpolate(start: ClipPathLayer, end: ClipPathLayer, fraction: number) {
    this.pathData = this.pathData.interpolate(start.pathData, end.pathData, fraction);
  }
}
