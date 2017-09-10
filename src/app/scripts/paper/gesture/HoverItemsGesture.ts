import {
  Cursor,
  Cursors,
  Guides,
  HitTests,
  Items,
  Pivots,
  Selections,
} from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations.
 */
export class HoverItemsGesture extends Gesture {
  constructor(private readonly ps: PaperService) {
    super();
  }

  // TODO: update cursor appropriately during hover events

  // @Override
  onMouseMove({ point }: paper.ToolEvent) {
    // Cursors.clear();

    const selectedLayers = this.ps.getSelectedLayers();
    const hitResult = HitTests.selectionMode(point, ({ item }: paper.HitResult) => {
      // TODO: support hovering over groups?
      return item instanceof paper.Path && !selectedLayers.has(item.data.id);
    });
    this.ps.setHoveredLayer(hitResult ? hitResult.item.data.id : undefined);

    // const selectionBounds = Guides.getSelectionBoundsPath();
    // if (selectionBounds) {
    //   const res = HitTests.selectionBoundsPivot(selectionBounds, point);
    //   if (res) {
    //     Cursors.set(Pivots.getResizeCursor(res.segment.index));
    //   }
    // }
  }
}
