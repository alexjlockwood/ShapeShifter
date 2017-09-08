import { PaperLayer } from 'app/scripts/paper/item';
import { Guides, Items, Layers, Selections, Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects one or more items using a selection box.
 */
export class BatchSelectItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  constructor(private readonly paperService: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit
      // test, so deselect everything on mouse down (unless the user is
      // holding shift).
      this.paperService.clearSelections();
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.paperService.setSelectionBox(event.downPoint, event.point);
    this.selectItemsInSelectionBox(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.selectItemsInSelectionBox(event);
    this.paperService.clearSelectionBox();
  }

  private selectItemsInSelectionBox(event: paper.ToolEvent) {
    const selectionBox = this.paperService.getSelectionBox();
    if (!selectionBox) {
      return;
    }
    const from = Transforms.mousePointToLocalCoordinates(new paper.Point(selectionBox.from));
    const to = Transforms.mousePointToLocalCoordinates(new paper.Point(selectionBox.to));
    const selectedItems = this.paperLayer.findItemsInBounds(new paper.Rectangle(from, to));

    // TODO: select layers all at once rather than individually
    // TODO: make this properly deselect items when no matches are found
    selectedItems.forEach(item =>
      this.paperService.selectLayer(item.data.id, !event.modifiers.shift),
    );
  }
}
