import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs selection, move, and clone operations
 * on one or more items. This gesture is only used during selection mode.
 */
export class SelectDragCloneItemsGesture extends Gesture {
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
    console.log(event.point, event.lastPoint);
    const dragVector = event.point.subtract(event.downPoint);
    this.selectedItems.forEach((item, i) => {
      if (event.modifiers.shift) {
        // TODO: transform the drag vector liek we do below
        const snapPoint = new paper.Point(MathUtil.snapDeltaToAngle(dragVector, 15));
        item.position = this.initialItemPositions[i].add(snapPoint);
      } else {
        const downPoint = transformPoint(item, event.downPoint);
        const lastPoint = transformPoint(item, event.lastPoint);
        const point = transformPoint(item, event.point);
        const delta = point.subtract(lastPoint);
        item.position = item.position.add(delta);
      }
    });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    Guides.hideSelectionBoundsPath();
    if (this.selectedItems.length) {
      Guides.showSelectionBoundsPath(Items.computeBoundingBox(this.selectedItems));
    }
  }
}

function transformPoint(item: paper.Item, point: paper.Point) {
  const matrix = new paper.Matrix();
  while (item.parent) {
    matrix.append(item.parent.matrix.inverted());
    item = item.parent;
  }
  return point.transform(matrix);
}
