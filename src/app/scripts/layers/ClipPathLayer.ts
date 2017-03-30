import { Path, PathUtil } from '../paths';
import { AbstractLayer } from './AbstractLayer';

/**
 * Model object that mirrors the VectorDrawable's '<clip-path>' element.
 */
export class ClipPathLayer extends AbstractLayer {
  constructor(
    id: string,
    public pathData: Path,
  ) {
    super(undefined, id);
  }

  interpolate(start: ClipPathLayer, end: ClipPathLayer, fraction: number) {
    this.pathData = PathUtil.interpolate(start.pathData, end.pathData, fraction);
  }
}
