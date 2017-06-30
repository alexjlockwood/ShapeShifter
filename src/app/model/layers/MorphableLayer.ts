import { Path } from 'app/model/paths';

import { Layer } from './Layer';

/**
 * Common interface for Layers with pathData properties.
 */
export interface MorphableLayer extends Layer {
  pathData: Path;

  isStroked(): boolean;

  isFilled(): boolean;
}
