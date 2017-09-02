import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

/**
 * Represents the base class for for all canvas editor tools. Subclasses should
 * override the protected 'onXXXXX' methods, which will be invoked in response
 * to external calls to the 'dispatchXXX' methods.
 */
export abstract class BaseTool {
  /**
   * Dispatcher method that invokes the onActivate() callback.
   */
  dispatchActivate() {
    this.onActivate();
  }

  /**
   * Dispatcher method that invokes the onMouseEvent() and
   * onKeyEvent() callbacks.
   */
  dispatchEvent(event: paper.ToolEvent | paper.KeyEvent) {
    if (event instanceof paper.ToolEvent) {
      this.onMouseEvent(event);
    } else if (event instanceof paper.KeyEvent) {
      this.onKeyEvent(event);
    }
  }

  /**
   * Dispatcher method that invokes the onToolModeChanged() callback.
   */
  dispatchToolModeChanged(toolMode: ToolMode) {
    this.onToolModeChanged(toolMode);
  }

  /**
   * Dispatcher method that invokes the onDeactivate() callback.
   */
  dispatchDeactivate() {
    this.onDeactivate();
  }

  protected onActivate() {}
  protected onToolModeChanged(toolMode: ToolMode) {}
  protected onMouseEvent(event: paper.ToolEvent) {}
  protected onKeyEvent(event: paper.KeyEvent) {}
  protected onDeactivate() {}
}
