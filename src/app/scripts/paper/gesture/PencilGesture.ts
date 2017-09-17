import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class PencilGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private isDragging = false;
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    const delta = this.paperLayer
      .globalToLocal(event.point)
      .subtract(this.paperLayer.globalToLocal(event.lastPoint));
    delta.angle += 90;
    const pathDataPreview = this.ps.getPathOverlayInfo();
    const pathOverlay = pathDataPreview ? new paper.Path(pathDataPreview) : new paper.Path();
    pathOverlay.add(this.paperLayer.globalToLocal(event.middlePoint).add(delta));
    this.ps.setPathOverlayInfo({ pathData: pathOverlay.pathData, strokeColor: 'black' });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.isDragging) {
      const newPath = new paper.Path(this.ps.getPathOverlayInfo());
      // TODO: express '0.25' in terms of physical pixels, not viewport pixels
      const nearStart = checkPointsClose(
        newPath.firstSegment.point,
        this.paperLayer.globalToLocal(event.point),
        0.25,
      );
      if (nearStart) {
        newPath.closePath(true);
      }
      newPath.smooth({ type: 'continuous' });
      const vl = this.ps.getVectorLayer().clone();
      const pl = new PathLayer({
        name: LayerUtil.getUniqueLayerName([vl], 'path'),
        children: [] as Layer[],
        pathData: new Path(newPath.pathData),
        fillColor: '#000',
      });
      const children = [...vl.children, pl];
      vl.children = children;
      this.ps.setVectorLayer(vl);
      this.ps.setPathOverlayInfo(undefined);
      this.ps.setSelectedLayers(new Set([pl.id]));
    }
    this.ps.setToolMode(ToolMode.Selection);
  }
}

function checkPointsClose(startPos: paper.Point, eventPoint: paper.Point, threshold: number) {
  const xOff = Math.abs(startPos.x - eventPoint.x);
  const yOff = Math.abs(startPos.y - eventPoint.y);
  return xOff < threshold && yOff < threshold;
}
