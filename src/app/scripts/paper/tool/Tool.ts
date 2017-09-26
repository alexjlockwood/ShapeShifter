import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

/**
 * Represents the base class for all tool types.
 */
export abstract class Tool {
  /** Called immediately after this tool has been activated. */
  onActivate() {}

  /** Called when the tool mode has changed. */
  onToolModeChanged(toolMode: ToolMode) {}

  /** Called when this tool has received a mouse event. */
  onMouseEvent(event: paper.ToolEvent) {}

  /** Called when this tool has received a key event. */
  onKeyEvent(event: paper.KeyEvent) {}

  /** Called immediately after this tool has been deactivated. */
  onDeactivate() {}
}
