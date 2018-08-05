import { CursorType } from 'app/modules/editor/model/paper';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that performs rotation operations.
 *
 * Preconditions:
 * - The user is in default mode.
 * - One or more layers are selected.
 * - A mouse down event occurred on top of the rotate items pivot.
 */
export class RotateItemsDragPivotGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private vpInitialPivotPoint: paper.Point;
  private vpDownPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setCursorType(CursorType.Grabbing);

    // TODO: reuse this code with PaperLayer (filter out empty groups)
    const selectedItems = Array.from(this.ps.getSelectedLayerIds())
      .map(id => this.pl.findItemByLayerId(id))
      .filter(i => !(i instanceof paper.Group) || i.children.length);
    const invertedPaperLayerMatrix = this.pl.matrix.inverted();
    const rii = this.ps.getRotateItemsInfo();
    if (rii.pivot) {
      this.vpInitialPivotPoint = new paper.Point(rii.pivot);
    } else {
      this.vpInitialPivotPoint = PaperUtil.transformRectangle(
        PaperUtil.computeBounds(selectedItems),
        invertedPaperLayerMatrix,
      ).center;
    }
    this.vpDownPoint = this.pl.globalToLocal(event.downPoint);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const vpPoint = this.pl.globalToLocal(event.point);
    const pivot = this.vpInitialPivotPoint.add(vpPoint.subtract(this.vpDownPoint));
    this.ps.setRotateItemsInfo({ pivot });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ps.setCursorType(CursorType.Default);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {}

  // @Override
  onKeyUp(event: paper.KeyEvent) {}
}
