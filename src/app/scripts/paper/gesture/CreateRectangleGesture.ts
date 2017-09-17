import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that creates a rectangular bath.
 */
export class CreateRectangleGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private isDragging = false;
  constructor(private readonly ps: PaperService, private readonly cornerRadius = 0) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    const rect = new paper.Rectangle(
      this.paperLayer.globalToLocal(event.downPoint),
      this.paperLayer.globalToLocal(event.point),
    );
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
    this.ps.setPathOverlayInfo({ pathData: path.pathData, strokeColor: 'black' });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.isDragging) {
      const path = new paper.Path(this.ps.getPathOverlayInfo());
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
