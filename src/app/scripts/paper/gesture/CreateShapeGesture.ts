import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * Base class for all shape-building gestures.
 */
abstract class CreateShapeGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private lastDragEventInfo: Readonly<{ downPoint: paper.Point; point: paper.Point }>;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const downPoint = this.paperLayer.globalToLocal(event.downPoint);
    const point = this.paperLayer.globalToLocal(event.point);
    this.lastDragEventInfo = { downPoint, point };
    this.processEvent(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.lastDragEventInfo) {
      const { pathData } = this.ps.getPathOverlayInfo();
      const newPathLayer = PaperUtil.addPathToStore(this.ps, pathData);
      this.ps.setSelectedLayers(new Set([newPathLayer.id]));
    }
    this.finishGesture();
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'shift' || event.key === 'alt') {
      this.processEvent(event);
    } else if (event.key === 'esc') {
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
    const { downPoint, point } = this.lastDragEventInfo;

    // If shift is pressed, then create a circle by setting the height equal to the width.
    const size = new paper.Size(
      point.x - downPoint.x,
      shift ? point.x - downPoint.x : point.y - downPoint.y,
    ).multiply(alt ? 2 : 1);

    // If alt is pressed, then the initial downpoint represents the ellipse's center point.
    const topLeft = alt
      ? downPoint.subtract(new paper.Point(size.width / 2, size.height / 2))
      : downPoint;

    const { pathData } = this.newPath(new paper.Rectangle(topLeft, size));
    this.ps.setPathOverlayInfo({ pathData, strokeColor: 'black' });
  }

  private finishGesture() {
    this.ps.setPathOverlayInfo(undefined);
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
