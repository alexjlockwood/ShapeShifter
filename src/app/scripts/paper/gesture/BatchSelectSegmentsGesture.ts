import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects multiple segments using a bounded box.
 * This gesture is only used during edit path mode.
 */
export class BatchSelectSegmentsGesture extends Gesture {
  constructor(private readonly selectedEditPath: paper.Path) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      this.selectedEditPath.segments.forEach(s => (s.selected = false));
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const selectionBox = Guides.showSelectionBoxPath(event.downPoint, event.point);
    this.selectSegmentsInBounds(event, selectionBox);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const selectionBox = Guides.getSelectionBoxPath();
    if (selectionBox) {
      this.selectSegmentsInBounds(event, selectionBox);
      selectionBox.remove();
    }
  }

  private selectSegmentsInBounds(event: paper.ToolEvent, selectionBox: paper.Path.Rectangle) {
    this.selectedEditPath.segments.forEach(segment => {
      segment.curve.selected =
        selectionBox.contains(segment.point) || (event.modifiers.shift && segment.selected);
    });
  }
}
