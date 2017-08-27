import * as paper from 'paper';

export abstract class Gesture {
  onMouseDown(event: paper.ToolEvent) {}
  onMouseDrag(event: paper.ToolEvent) {}
  onMouseMove(event: paper.ToolEvent) {}
  onMouseUp(event: paper.ToolEvent) {}
  onKeyDown(event: paper.KeyEvent) {}
  onKeyUp(event: paper.KeyEvent) {}
}
