import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { Guides, Items, Selections, Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that creates an elliptical bath.
 */
export class CreateEllipseGesture extends Gesture {
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const downPoint = Transforms.mousePointToLocalCoordinates(event.downPoint);
    const point = Transforms.mousePointToLocalCoordinates(event.point);
    const ex = point.x;
    const ey = point.y;
    const ellipseSize = new paper.Size(
      ex - downPoint.x,
      // If shift is pressed, then create a circle.
      event.modifiers.shift ? ex - downPoint.x : ey - downPoint.y,
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
    this.ps.setShapePreview(ellipsePath.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const shapePreview = this.ps.getShapePreview();
    if (shapePreview) {
      const path = new paper.Path(shapePreview);
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
      this.ps.setShapePreview(undefined);
      this.ps.setSelectedLayers(new Set([pl.id]));
    }
    this.ps.setToolMode(ToolMode.Selection);
  }

  // TODO: listen for key press events and update the shape preview accordingly
  // TODO: double the size of the shape when alt is pressed
}
