import { ToolMode } from 'app/model/paper';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * Base class for all shape-building gestures.
 */
abstract class CreateShapeGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private lastDragEventInfo: Readonly<{ vpDownPoint: paper.Point; vpPoint: paper.Point }>;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const vpDownPoint = this.pl.globalToLocal(event.downPoint);
    const vpPoint = this.pl.globalToLocal(event.point);
    this.lastDragEventInfo = { vpDownPoint, vpPoint };
    this.processEvent(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.lastDragEventInfo) {
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
      // TODO: test that escape works as expected
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
    const { vpDownPoint, vpPoint } = this.lastDragEventInfo;

    // If shift is pressed, then create a circle by setting the height equal to the width.
    const size = new paper.Size(
      vpPoint.x - vpDownPoint.x,
      shift ? vpPoint.x - vpDownPoint.x : vpPoint.y - vpDownPoint.y,
    ).multiply(alt ? 2 : 1);

    // If alt is pressed, then the initial downpoint represents the ellipse's center point.
    const topLeft = alt
      ? vpDownPoint.subtract(new paper.Point(size.width / 2, size.height / 2))
      : vpDownPoint;

    const { pathData } = this.newPath(new paper.Rectangle(topLeft, size));
    this.ps.setCreatePathInfo({ pathData, strokeColor: 'black' });
  }

  private finishGesture() {
    this.ps.setCreatePathInfo(undefined);
    this.ps.setToolMode(ToolMode.Selection);
  }

  /** Factory method that creates a new path given its bounding box.  */
  protected abstract newPath(bounds: paper.Rectangle);
}

/**
 * A gesture that creates a rectangular path.
 */
export class CreateRectangleGesture extends CreateShapeGesture {
  // @Override
  protected newPath(bounds: paper.Rectangle) {
    return new paper.Path.Rectangle(bounds);
  }
}

/**
 * A gesture that creates an elliptical path.
 */
export class CreateEllipseGesture extends CreateShapeGesture {
  // @Override
  protected newPath(bounds: paper.Rectangle) {
    return new paper.Path.Ellipse(bounds);
  }
}
