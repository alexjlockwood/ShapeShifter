import {
  Cursor,
  Cursors,
  Guides,
  HitTests,
  Items,
  Pivots,
  Selections,
} from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations.
 *
 * This gesture is used as the default gesture during selection mode.
 * It listens for mouse move events and reacts by drawing overlays
 * on top of items and changing the cursor style accordingly.
 */
export class HoverGesture extends Gesture {
  /**
   * Takes the currently selected path to edit. If present, then the user
   * is in edit path mode. Otherwise the user is in selection mode.
   */
  constructor(private readonly selectedEditPath?: paper.Path) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    if (this.selectedEditPath) {
      this.handleEditPathModeHover(event.point);
    } else {
      this.handleSelectionModeHover(event.point);
    }
  }

  private handleSelectionModeHover(point: paper.Point) {
    Cursors.clear();
    const hitResult = paper.project.activeLayer.hitTest(point, {
      stroke: true,
      fill: true,
      tolerance: 8 / paper.view.zoom,
      match: (res: paper.HitResult) => {
        return Items.isPath(res.item) && !res.item.selected;
      },
    });
    if (hitResult) {
      Guides.showHoverPath(hitResult.item as paper.Path);
    } else {
      Guides.hideHoverPath();
    }

    const selectionBounds = Guides.getSelectionBoundsPath();

    if (selectionBounds) {
      const res = HitTests.selectionBoundsPivot(selectionBounds, point);
      if (res) {
        const cursor = Pivots.getResizeCursor(res.segment.index);
        Cursors.set(cursor);
      }
    }
  }

  private handleEditPathModeHover(point: paper.Point) {}
}
