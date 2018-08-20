import * as paper from 'paper';

/**
 * A gesture represents a user interaction with the mouse or keyboard. Typically
 * a gesture is used in one of two ways:
 *
 * (1) To monitor the state of events that occurs between the initial
 *     mouse down through the final mouse up.
 *
 * (2) To monitor mouse move events and react accordingly.
 */
export abstract class Gesture {
  onMouseDown(event: paper.ToolEvent) {}
  onMouseDrag(event: paper.ToolEvent) {}
  onMouseMove(event: paper.ToolEvent) {}
  onMouseUp(event: paper.ToolEvent) {}
  onKeyDown(event: paper.KeyEvent) {}
  onKeyUp(event: paper.KeyEvent) {}
}
