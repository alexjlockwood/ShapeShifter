import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class RectangleGesture extends Gesture {
  constructor(private readonly cornerRadius = 0) {
    super();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const rect = new paper.Rectangle(event.downPoint, event.point);
    if (event.modifiers.shift) {
      rect.height = rect.width;
    }
    const path = new paper.Path.Rectangle(
      rect,
      new paper.Size(this.cornerRadius, this.cornerRadius),
    );
    if (event.modifiers.alt) {
      path.position = event.downPoint;
    }
    path.removeOnDrag();
  }
}
