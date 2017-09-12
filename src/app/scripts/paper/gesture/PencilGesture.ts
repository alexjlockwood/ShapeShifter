import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class PencilGesture extends Gesture {
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const pathDataPreview = this.ps.getPathPreview();
    const pathPreview = pathDataPreview ? new paper.Path(pathDataPreview) : new paper.Path();
    const lastPoint = Transforms.mousePointToLocalCoordinates(event.lastPoint);
    const point = Transforms.mousePointToLocalCoordinates(event.point);
    const delta = point.subtract(lastPoint);
    const middlePoint = Transforms.mousePointToLocalCoordinates(event.middlePoint);
    delta.angle += 90;
    pathPreview.add(middlePoint.add(delta));
    this.ps.setPathPreview(pathPreview.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const pathDataPreview = this.ps.getPathPreview();
    if (pathDataPreview) {
      const pathPreview = new paper.Path(pathDataPreview);
      // TODO: express '0.25' in terms of physical pixels, not viewport pixels
      const point = Transforms.mousePointToLocalCoordinates(event.point);
      const nearStart = checkPointsClose(pathPreview.firstSegment.point, point, 0.25);
      if (nearStart) {
        pathPreview.closePath(true);
      }
      pathPreview.smooth({ type: 'continuous' });
      const vl = this.ps.getVectorLayer().clone();
      const pl = new PathLayer({
        name: LayerUtil.getUniqueLayerName([vl], 'path'),
        children: [] as Layer[],
        pathData: new Path(pathPreview.pathData),
        fillColor: '#000',
      });
      const children = [...vl.children, pl];
      vl.children = children;
      this.ps.setVectorLayer(vl);
      this.ps.setPathPreview(undefined);
      this.ps.setSelectedLayers(new Set([pl.id]));
    }
    this.ps.setToolMode(ToolMode.Selection);
  }
}

function checkPointsClose(startPos: paper.Point, eventPoint: paper.Point, threshold: number) {
  const xOff = Math.abs(startPos.x - eventPoint.x);
  const yOff = Math.abs(startPos.y - eventPoint.y);
  console.log(xOff, yOff, threshold);
  return xOff < threshold && yOff < threshold;
}
