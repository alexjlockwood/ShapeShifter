import * as paper from 'paper';

import { SelectionBoundsRaster } from './SelectionBoundsRaster';

export class SelectionBoundsSegmentRaster extends SelectionBoundsRaster {
  constructor(center: paper.Point) {
    super('/assets/handle.png', center);
  }
}
