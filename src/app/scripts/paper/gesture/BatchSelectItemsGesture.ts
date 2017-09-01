import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects multiple items using a bounded box.
 * This gesture is only used during selection mode.
 */
export class BatchSelectItemsGesture extends Gesture {
  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit
      // test, so deselect everything on mouse down (unless the user is
      // holding shift).
      Selections.deselectAll();
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const selectionBox = Guides.showSelectionBoxPath(event.downPoint, event.point);
    // TODO: make sure to only process selectable items
    selectItemsInBounds(event, selectionBox, paper.project.activeLayer.getItems());
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const selectionBox = Guides.getSelectionBoxPath();
    if (selectionBox) {
      // TODO: make sure to only process selectable items
      selectItemsInBounds(event, selectionBox, paper.project.activeLayer.getItems());
      selectionBox.remove();
    }
    Guides.hideSelectionBoundsPath();
    const selectedItems = Selections.getSelectedPaths();
    if (selectedItems.length) {
      Guides.showSelectionBoundsPath(Items.computeBoundingBox(selectedItems));
    }
  }
}

// TODO: could we use Item#getItems() instead? (using the 'overlapping' option)
function selectItemsInBounds(
  event: paper.ToolEvent,
  selectionBox: paper.Path.Rectangle,
  selectableItems: ReadonlyArray<paper.Item>,
) {
  selectableItems.forEach(item => {
    if (!Items.isPath(item)) {
      // TODO: figure out how to deal with groups and compound paths
      // TODO: look at stylii to see how it handles paper.Shape items
      return;
    }

    // First round of checks for segments inside the selection box.
    for (const segment of item.segments) {
      if (selectionBox.contains(segment.point)) {
        Selections.setSelection(item, !event.modifiers.shift || !item.selected);
        return;
      }
    }

    // Second round of checks for path intersections.
    const intersections = item.getIntersections(selectionBox);
    if (intersections.length > 0) {
      Selections.setSelection(item, !event.modifiers.shift || !item.selected);
      return;
    }

    Selections.setSelection(item, false);
  });
}
