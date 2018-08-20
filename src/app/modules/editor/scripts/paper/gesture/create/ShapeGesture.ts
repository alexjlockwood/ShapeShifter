import { ToolMode } from 'app/modules/editor/model/paper';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/** Base class for all shape-building gestures. */
export abstract class ShapeGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  private vpLastDragInfo: Readonly<{ vpDownPoint: paper.Point; vpPoint: paper.Point }>;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const vpDownPoint = this.pl.globalToLocal(event.downPoint);
    const vpPoint = this.pl.globalToLocal(event.point);
    this.vpLastDragInfo = { vpDownPoint, vpPoint };
    this.processEvent(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.vpLastDragInfo) {
      const { pathData } = this.ps.getCreatePathInfo();
      const newPathLayer = PaperUtil.addPathToStore(this.ps, pathData);
      this.ps.setSelectedLayerIds(new Set([newPathLayer.id]));
    }
    this.finishGesture();
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'shift' || event.key === 'alt') {
      this.processEvent(event);
    } else if (event.key === 'escape') {
      this.finishGesture();
    }
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    if (event.key === 'shift' || event.key === 'alt') {
      this.processEvent(event);
    }
  }

  private processEvent({ modifiers: { alt, shift } }: paper.Event) {
    const { vpDownPoint, vpPoint } = this.vpLastDragInfo;

    // If shift is pressed, then set the height equal to the width.
    const vpSize = new paper.Size(
      vpPoint.x - vpDownPoint.x,
      shift ? vpPoint.x - vpDownPoint.x : vpPoint.y - vpDownPoint.y,
    ).multiply(alt ? 2 : 1);

    // If alt is pressed, then the initial downpoint represents the shape's center point.
    const vpTopLeft = alt
      ? vpDownPoint.subtract(new paper.Point(vpSize.width / 2, vpSize.height / 2))
      : vpDownPoint;

    const { pathData } = this.newPath(new paper.Rectangle(vpTopLeft, vpSize));
    this.ps.setCreatePathInfo({ pathData, strokeColor: '#979797' });
  }

  private finishGesture() {
    this.ps.setCreatePathInfo(undefined);
    this.ps.setToolMode(ToolMode.Default);
  }

  /** Factory method that creates a new path given its bounding box. */
  protected abstract newPath(vpBounds: paper.Rectangle): paper.Path;
}
