import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

/**
 * Represents the base class for all tool modes.
 */
export abstract class Tool {
  onActivate() {}
  onToolModeChanged(toolMode: ToolMode) {}
  onMouseEvent(event: paper.ToolEvent) {}
  onKeyEvent(event: paper.KeyEvent) {}
  onDeactivate() {}
}
