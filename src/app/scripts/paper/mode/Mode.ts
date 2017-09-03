import * as paper from 'paper';

/**
 * Represents the base class for all tool modes.
 */
export abstract class Mode {
  onActivate() {}
  onMouseEvent(event: paper.ToolEvent) {}
  onKeyEvent(event: paper.KeyEvent) {}
  onDeactivate() {}
}
