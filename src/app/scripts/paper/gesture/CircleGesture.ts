import { Layer, LayerUtil, PathLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Path } from 'app/model/paths';
import { Guides, Items, Selections, Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class CircleGesture extends Gesture {
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const downPoint = Transforms.mousePointToLocalCoordinates(event.downPoint);
    const point = Transforms.mousePointToLocalCoordinates(event.point);
    const ex = point.x;
    const ey = point.y;
    const ellipse = paper.Shape.Ellipse(new paper.Rectangle(downPoint, new paper.Size(0, 0)));
    if (event.modifiers.shift) {
      ellipse.size = new paper.Size(downPoint.x - ex, downPoint.x - ex);
    } else {
      ellipse.size = new paper.Size(downPoint.x - ex, downPoint.y - ey);
    }
    const ellipsePath = ellipse.toPath(false);
    ellipsePath.applyMatrix = true;
    if (event.modifiers.alt) {
      ellipsePath.transform(new paper.Matrix(1, 0, 0, 1, downPoint.x, downPoint.y));
    } else {
      const position = downPoint.subtract(new paper.Point(ellipse.size.divide(2)));
      ellipsePath.transform(new paper.Matrix(1, 0, 0, 1, position.x, position.y));
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
}
