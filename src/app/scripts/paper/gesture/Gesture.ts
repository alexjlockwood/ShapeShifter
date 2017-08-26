import * as paper from 'paper';

export abstract class Gesture {
  onMouseDown(event: paper.ToolEvent, hitResult?: paper.HitResult) {}
  onMouseDrag(event: paper.ToolEvent) {}
  onMouseMove(event: paper.ToolEvent) {}
  onMouseUp(event: paper.ToolEvent) {}
}
