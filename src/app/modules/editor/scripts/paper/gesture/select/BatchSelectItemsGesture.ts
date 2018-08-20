import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that selects one or more items using a selection box.
 *
 * Preconditions:
 * - The user is in default mode.
 */
export class BatchSelectItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  // private initialSelectedLayers: ReadonlySet<string>;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      // A selection box implies that the gesture began with a failed hit test,
      // so deselect everything on mouse down (unless the user is holding shift).
      this.ps.setSelectedLayerIds(new Set());
    }
    // TODO: make use of this information (i.e. toggle the layers when shift is pressed)
    // this.initialSelectedLayers = this.ps.getSelectedLayerIds();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.ps.setSelectionBox({
      from: this.pl.globalToLocal(event.downPoint),
      to: this.pl.globalToLocal(event.point),
    });
    this.selectItemsInSelectionBox(!event.modifiers.alt);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.selectItemsInSelectionBox(!event.modifiers.alt);
    this.ps.setSelectionBox(undefined);
    this.ps.setRotateItemsInfo(undefined);
    this.ps.setTransformPathsInfo(undefined);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      this.selectItemsInSelectionBox(false);
    }
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      this.selectItemsInSelectionBox(true);
    }
  }

  private selectItemsInSelectionBox(includePartialOverlaps: boolean) {
    const box = this.ps.getSelectionBox();
    if (box) {
      const from = new paper.Point(box.from);
      const to = new paper.Point(box.to);
      const selectedItems = this.pl.findItemsInBounds(
        new paper.Rectangle(from, to),
        includePartialOverlaps,
      );
      this.ps.setSelectedLayerIds(new Set(selectedItems.map(i => i.data.id)));
    }
  }
}
