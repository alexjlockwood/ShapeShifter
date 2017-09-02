import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

/**
 * Represents the base class for all canvas editor tools.
 */
export abstract class BaseTool {
  onActivate() {}
  onToolModeChanged(toolMode: ToolMode) {}
  onMouseEvent(event: paper.ToolEvent) {}
  onKeyEvent(event: paper.KeyEvent) {}
  onDeactivate() {}
}
