import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that draws a path using the mouse.
 */
export class PencilGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private lastPoint: paper.Point;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    if (!this.lastPoint) {
      this.lastPoint = event.downPoint;
    }
    const delta = this.paperLayer
      .globalToLocal(event.point)
      .subtract(this.paperLayer.globalToLocal(this.lastPoint));
    delta.angle += 90;
    const pathOverlayInfo = this.ps.getPathOverlayInfo();
    const pencilPath = pathOverlayInfo
      ? new paper.Path(pathOverlayInfo.pathData)
      : new paper.Path();
    pencilPath.add(this.paperLayer.globalToLocal(event.middlePoint).add(delta));
    this.ps.setPathOverlayInfo({ pathData: pencilPath.pathData, strokeColor: 'black' });
    this.lastPoint = event.point;
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.lastPoint) {
      const newPath = new paper.Path(this.ps.getPathOverlayInfo().pathData);
      if (arePointsClose(this.paperLayer.localToGlobal(newPath.firstSegment.point), event.point)) {
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
 * belong to the global project coordinate space.
 */
function arePointsClose(p1: paper.Point, p2: paper.Point, tolerance = 10) {
  return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
}
