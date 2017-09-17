import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that creates an elliptical path.
 */
export class CreateEllipseGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private isDragging = false;
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    const downPoint = this.paperLayer.globalToLocal(event.downPoint);
    const { x, y } = this.paperLayer.globalToLocal(event.point);
    const ellipseSize = new paper.Size(
      x - downPoint.x,
      // If shift is pressed, then create a circle.
      event.modifiers.shift ? x - downPoint.x : y - downPoint.y,
    );
    const ellipsePath = paper.Shape
      .Ellipse(new paper.Rectangle(downPoint, ellipseSize))
      .toPath(false);
    ellipsePath.applyMatrix = true;
    if (event.modifiers.alt) {
      // If alt is pressed, then the initial downpoint represents the ellipse's
      // center point.
      const halfWidth = ellipseSize.width / 2;
      const halfHeight = ellipseSize.height / 2;
      ellipsePath.transform(new paper.Matrix(1, 0, 0, 1, -halfWidth, -halfHeight));
    }
    this.ps.setPathOverlayInfo({ pathData: ellipsePath.pathData, strokeColor: 'black' });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.isDragging) {
      const pathOverlay = this.ps.getPathOverlayInfo();
      const path = new paper.Path(pathOverlay);
      const vl = this.ps.getVectorLayer().clone();
      const pl = new PathLayer({
        name: LayerUtil.getUniqueLayerName([vl], 'path'),
        children: [] as Layer[],
        pathData: new Path(path.pathData),
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

  // TODO: listen for key press events and update the shape preview accordingly
  // TODO: double the size of the shape when alt is pressed
}
