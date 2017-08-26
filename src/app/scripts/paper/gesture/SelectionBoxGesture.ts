import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/** A gesture that selects multiple items using a bounded box. */
export class SelectionBoxGesture extends Gesture {
  constructor(private readonly selectSegments: boolean) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    Guides.hideHoverPath();

    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit
      // test, so deselect everything on mouse down (unless the user is
      // holding shift).
      Selections.deselectAll();
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    // TODO: could this be more efficient?
    Guides.showSelectionBoxPath(event.downPoint, event.point).removeOnDrag();
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const selectionBoxPath = Guides.getSelectionBoxPath();
    if (selectionBoxPath) {
      Selections.processRectangularSelection(event, selectionBoxPath, this.selectSegments);
      selectionBoxPath.remove();
    }

    Guides.hideSelectionBounds();
    const selectedItems = Selections.getSelectedItems();
    if (selectedItems.length) {
      Guides.showSelectionBounds(Items.computeBoundingBox(selectedItems));
    }
  }
}
