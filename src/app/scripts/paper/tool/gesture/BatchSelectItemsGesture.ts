import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects one or more items using a selection box.
 */
export class BatchSelectItemsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private initialSelectedLayers: ReadonlySet<string>;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit
      // test, so deselect everything on mouse down (unless the user is
      // holding shift).
      this.ps.setSelectedLayers(new Set());
    }
    // TODO: make use of this information (i.e. toggle the layers when shift is pressed)
    this.initialSelectedLayers = this.ps.getSelectedLayers();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.ps.setSelectionBox({
      from: this.paperLayer.globalToLocal(event.downPoint),
      to: this.paperLayer.globalToLocal(event.point),
    });
    this.selectItemsInSelectionBox(event.modifiers.alt);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.selectItemsInSelectionBox(event.modifiers.alt);
    this.ps.setSelectionBox(undefined);
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
    const box = this.ps.getSelectionBox();
    if (!box) {
      return;
    }
    const from = new paper.Point(box.from);
    const to = new paper.Point(box.to);
    const selectedItems = this.paperLayer.findItemsInBounds(
      new paper.Rectangle(from, to),
      !isAltPressed,
    );
    this.ps.setSelectedLayers(new Set(selectedItems.map(i => i.data.id)));
  }
}
