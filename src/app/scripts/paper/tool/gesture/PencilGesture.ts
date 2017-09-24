import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
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
  private lastPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const { downPoint, middlePoint, point } = event;
    if (!this.lastPoint) {
      this.lastPoint = downPoint;
    }
    const delta = this.pl.globalToLocal(point).subtract(this.pl.globalToLocal(this.lastPoint));
    delta.angle += 90;
    const pathOverlayInfo = this.ps.getPathOverlayInfo();
    const pencilPath = pathOverlayInfo
      ? new paper.Path(pathOverlayInfo.pathData)
      : new paper.Path();
    pencilPath.add(this.pl.globalToLocal(middlePoint).add(delta));
    this.ps.setPathOverlayInfo({ pathData: pencilPath.pathData, strokeColor: 'black' });
    this.lastPoint = point;
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.lastPoint) {
      const newPath = new paper.Path(this.ps.getPathOverlayInfo().pathData);
      if (arePointsClose(this.pl.localToGlobal(newPath.firstSegment.point), event.point)) {
        newPath.closePath(true);
      }
      newPath.smooth({ type: 'continuous' });
      const newPathLayer = PaperUtil.addPathToStore(this.ps, newPath.pathData);
      this.ps.setSelectedLayers(new Set([newPathLayer.id]));
      this.ps.setPathOverlayInfo(undefined);
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
