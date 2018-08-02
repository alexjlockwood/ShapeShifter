import { Gesture } from 'app/editor/scripts/paper/gesture';
import { PaperService } from 'app/editor/services';
import * as paper from 'paper';

/**
 * A gesture that deselects a single item.
 *
 * Preconditions:
 * - The user is in default mode.
 */
export class DeselectItemGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly deselectedItemId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const layerIds = new Set(this.ps.getSelectedLayerIds());
    layerIds.delete(this.deselectedItemId);
    this.ps.setSelectedLayerIds(layerIds);
  }
}
