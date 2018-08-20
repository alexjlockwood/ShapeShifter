import { ToolMode } from 'app/modules/editor/model/paper';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that draws a path.
 *
 * Preconditions:
 * - The user is in pencil mode.
 */
export class PencilGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  // The last drag point in viewport coordinates.
  private vpLastPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const vpDownPoint = this.pl.globalToLocal(event.downPoint);
    const vpMiddlePoint = this.pl.globalToLocal(event.middlePoint);
    const vpPoint = this.pl.globalToLocal(event.point);
    if (!this.vpLastPoint) {
      this.vpLastPoint = vpDownPoint;
    }
    const vpDelta = vpPoint.subtract(this.vpLastPoint);
    vpDelta.angle += 90;
    const createPathInfo = this.ps.getCreatePathInfo();
    const pencilPath = createPathInfo ? new paper.Path(createPathInfo.pathData) : new paper.Path();
    pencilPath.add(vpMiddlePoint.add(vpDelta));
    this.ps.setCreatePathInfo({ pathData: pencilPath.pathData, strokeColor: '#979797' });
    this.vpLastPoint = vpPoint;
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.vpLastPoint) {
      this.vpLastPoint = this.pl.globalToLocal(event.point);
    }
    this.finishGesture();
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'escape') {
      this.finishGesture();
    }
  }

  private finishGesture() {
    if (this.vpLastPoint) {
      const newPath = new paper.Path(this.ps.getCreatePathInfo().pathData);
      const projStartPoint = this.pl.localToGlobal(newPath.firstSegment.point);
      const projLastPoint = this.pl.localToGlobal(this.vpLastPoint);
      // If the pencil path's start and end point are within 10px of each other
      // at the end of the gesture, then we should close the path before saving
      // it to the store.
      if (projStartPoint.isClose(projLastPoint, 10)) {
        newPath.closePath(true);
      }
      newPath.smooth({ type: 'continuous' });
      const newPathLayer = PaperUtil.addPathToStore(this.ps, newPath.pathData);
      this.ps.setSelectedLayerIds(new Set([newPathLayer.id]));
      this.ps.setCreatePathInfo(undefined);
    }
    this.ps.setToolMode(ToolMode.Default);
  }
}
