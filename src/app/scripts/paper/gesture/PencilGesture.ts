import { ToolMode } from 'app/model/paper';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that draws a path.
 *
 * Preconditions:
 * - The user is in pencil mode.
 */
export class PencilGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  // The last drag point in project coordinates.
  private projLastPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const { downPoint, middlePoint, point } = event;
    if (!this.projLastPoint) {
      this.projLastPoint = downPoint;
    }
    const delta = this.pl.globalToLocal(point).subtract(this.pl.globalToLocal(this.projLastPoint));
    delta.angle += 90;
    const pathOverlayInfo = this.ps.getCreatePathInfo();
    const pencilPath = pathOverlayInfo
      ? new paper.Path(pathOverlayInfo.pathData)
      : new paper.Path();
    pencilPath.add(this.pl.globalToLocal(middlePoint).add(delta));
    this.ps.setCreatePathInfo({ pathData: pencilPath.pathData, strokeColor: 'black' });
    this.projLastPoint = point;
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.projLastPoint) {
      const newPath = new paper.Path(this.ps.getCreatePathInfo().pathData);
      if (arePointsClose(this.pl.localToGlobal(newPath.firstSegment.point), event.point)) {
        newPath.closePath(true);
      }
      newPath.smooth({ type: 'continuous' });
      const newPathLayer = PaperUtil.addPathToStore(this.ps, newPath.pathData);
      this.ps.setSelectedLayerIds(new Set([newPathLayer.id]));
      this.ps.setCreatePathInfo(undefined);
    }
    this.ps.setToolMode(ToolMode.Selection);
  }
}

/**
 * Checks if two points are close enough to be connected. Note that p1 and p2 should
 * belong to the project coordinate space.
 */
function arePointsClose(p1: paper.Point, p2: paper.Point, tolerancePixels = 10) {
  return Math.abs(p1.x - p2.x) < tolerancePixels && Math.abs(p1.y - p2.y) < tolerancePixels;
}
