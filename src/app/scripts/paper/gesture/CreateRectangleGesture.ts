import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that creates a rectangular bath.
 */
export class CreateRectangleGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly cornerRadius = 0) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const downPoint = paper.project.activeLayer.globalToLocal(event.downPoint);
    const point = paper.project.activeLayer.globalToLocal(event.point);

    const rect = new paper.Rectangle(downPoint, point);
    if (event.modifiers.shift) {
      // If shift is pressed, then create a square.
      rect.height = rect.width;
    }
    const path = new paper.Path.Rectangle(
      rect,
      new paper.Size(this.cornerRadius, this.cornerRadius),
    );
    path.applyMatrix = true;
    if (event.modifiers.alt) {
      // If alt is pressed, then the initial downpoint represents the rectangle's
      // center point.
      const halfWidth = rect.width / 2;
      const halfHeight = rect.height / 2;
      path.transform(new paper.Matrix(1, 0, 0, 1, -halfWidth, -halfHeight));
    }
    this.ps.setPathPreview(path.pathData);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const shapePreview = this.ps.getPathPreview();
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
      this.ps.setPathPreview(undefined);
      this.ps.setSelectedLayers(new Set([pl.id]));
    }
    this.ps.setToolMode(ToolMode.Selection);
  }

  // TODO: listen for key press events and update the shape preview accordingly
  // TODO: double the size of the shape when alt is pressed
}
