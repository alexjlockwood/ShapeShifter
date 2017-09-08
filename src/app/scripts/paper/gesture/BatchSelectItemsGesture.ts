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
  private initialSelectedLayers: Set<string>;
  constructor(private readonly paperService: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit
      // test, so deselect everything on mouse down (unless the user is
      // holding shift).
      this.paperService.setSelectedLayers(new Set());
    }
    // TODO: make use of this information (i.e. toggle the layers when shift is pressed)
    this.initialSelectedLayers = this.paperService.getSelectedLayers();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.paperService.setSelectionBox({ from: event.downPoint, to: event.point });
    this.selectItemsInSelectionBox(event.modifiers.alt);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.selectItemsInSelectionBox(event.modifiers.alt);
    this.paperService.setSelectionBox(undefined);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      this.selectItemsInSelectionBox(true);
    }
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      this.selectItemsInSelectionBox(false);
    }
  }

  private selectItemsInSelectionBox(isAltPressed: boolean) {
    const box = this.paperService.getSelectionBox();
    if (!box) {
      return;
    }
    const from = Transforms.mousePointToLocalCoordinates(new paper.Point(box.from));
    const to = Transforms.mousePointToLocalCoordinates(new paper.Point(box.to));
    const selectedItems = this.paperLayer.findItemsInBounds(
      new paper.Rectangle(from, to),
      !isAltPressed,
    );
    this.paperService.setSelectedLayers(new Set(selectedItems.map(i => i.data.id)));
  }
}
