import * as paper from 'paper';

/** Represents the base class for all tool types. */
export abstract class Tool {
  /** Called immediately after this tool has been activated. */
  onActivate() {}

  /**
   * Called when this tool has received a tool event (i.e. mouse down,
   * mouse drag, mouse move, mouse up).
   */
  onToolEvent(event: paper.ToolEvent) {}

  /** Called when this tool has received a key event (i.e. key down, key up). */
  onKeyEvent(event: paper.KeyEvent) {}

  /** Called immediately after this tool has been deactivated. */
  onDeactivate() {}
}
