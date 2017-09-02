import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

export class PencilGesture extends Gesture {
  private path: paper.Path;

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.path = new paper.Path();
    this.path.strokeWidth = 6;
    this.path.strokeColor = 'black';
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const offset = event.delta.clone();
    offset.angle += 90;
    this.path.add(event.middlePoint.add(offset));
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.path.segments.length === 0) {
      // Discard accidental clicks that produce a path but no segments.
      return;
    }
    const nearStart = checkPointsClose(this.path.firstSegment.point, event.point, 30);
    if (nearStart) {
      this.path.closePath(true);
    }
    this.path.smooth({ type: 'continuous' });
  }
}

function checkPointsClose(startPos: paper.Point, eventPoint: paper.Point, threshold: number) {
  const xOff = Math.abs(startPos.x - eventPoint.x);
  const yOff = Math.abs(startPos.y - eventPoint.y);
  return xOff < threshold && yOff < threshold;
}
