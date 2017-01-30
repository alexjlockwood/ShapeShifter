import { PathCommand } from '..';
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
}
