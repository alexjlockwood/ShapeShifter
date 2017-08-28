import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection, move, and clone operations on one or
 * more items.
 */
export class SelectItemsGesture extends Gesture {
  private selectedItems: ReadonlyArray<paper.Item>;
  private initialItemPositions: ReadonlyArray<paper.Point>;

  // TODO: pressing alt should allow the user to select the item
  // directly beneath the hit item, if one exists.
  constructor(
    private readonly mouseDownHitItem: paper.Item,
    private readonly shouldCloneSelectedItems: boolean,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    Guides.hideHoverPath();

    if (!event.modifiers.shift && !this.mouseDownHitItem.selected) {
      Selections.deselectAll();
    }
    Selections.setSelection(this.mouseDownHitItem, true);

    if (this.shouldCloneSelectedItems) {
      Selections.cloneSelectedItems();
    }

    this.selectedItems = Selections.getSelectedItems();
    this.initialItemPositions = this.selectedItems.map(path => path.position);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const dragVector = event.point.subtract(event.downPoint);
    this.selectedItems.forEach((item, i) => {
      if (event.modifiers.shift) {
        const snapPoint = new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15));
        item.position = this.initialItemPositions[i].add(snapPoint);
      } else {
        item.position = item.position.add(event.delta);
      }
    });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Guides.hideSelectionBounds();
    if (this.selectedItems.length) {
      Guides.showSelectionBounds(Items.computeBoundingBox(this.selectedItems));
    }
  }
}
