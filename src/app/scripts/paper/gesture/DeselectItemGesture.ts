import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that deselects a single item.
 */
export class DeselectItemGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly deselectedItemId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setSelectedLayers(new Set());
    const layerIds = new Set(this.ps.getSelectedLayers());
    layerIds.delete(this.deselectedItemId);
    this.ps.setSelectedLayers(layerIds);
  }
}
