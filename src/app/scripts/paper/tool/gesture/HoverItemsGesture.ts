import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations on items.
 *
 * Preconditions:
 * - The user is in selection mode.
 */
export class HoverItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    CursorUtil.clear();

    const selectedLayers = this.ps.getSelectedLayers();
    if (selectedLayers.size > 0) {
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      if (selectionBoundSegmentsHitResult) {
        // TODO: how do we choose between scale vs. rotate cursors here?
        CursorUtil.set(selectionBoundSegmentsHitResult.item.resizeCursor);
        this.ps.setHoveredLayer(undefined);
        return;
      }
    }
    const hitResult = HitTests.selectionMode(event.point, {
      // TODO: support hovering over groups
      class: paper.Path,
      match: ({ item }) => !selectedLayers.has(item.data.id),
    });
    this.ps.setHoveredLayer(hitResult ? hitResult.item.data.id : undefined);
  }
}
