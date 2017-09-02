import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class CircleGesture extends Gesture {
  private ellipse: paper.Shape;

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ellipse = paper.Shape.Ellipse(new paper.Rectangle(event.downPoint, new paper.Size(0, 0)));
    this.ellipse.fillColor = 'black';
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const ex = event.point.x;
    const ey = event.point.y;
    if (event.modifiers.shift) {
      this.ellipse.size = new paper.Size(event.downPoint.x - ex, event.downPoint.x - ex);
    } else {
      this.ellipse.size = new paper.Size(event.downPoint.x - ex, event.downPoint.y - ey);
    }
    if (event.modifiers.alt) {
      this.ellipse.position = event.downPoint;
    } else {
      this.ellipse.position = event.downPoint.subtract(
        new paper.Point(this.ellipse.size.divide(2)),
      );
    }
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.ellipse.toPath(true);
    this.ellipse.remove();
  }
}
