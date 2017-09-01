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
   * Dispatcher method that invokes the onInterceptEvent() callback.
   */
  dispatchInterceptEvent(toolMode: ToolMode, event?: paper.ToolEvent | paper.KeyEvent) {
    return this.onInterceptEvent(toolMode, event);
  }

  /**
   * Dispatcher method that invokes the onMouseEvent(), onKeyEvent(),
   * and onToolModeEvent() callbacks.
   */
  dispatchEvent(event: ToolMode | paper.ToolEvent | paper.KeyEvent) {
    if (event instanceof paper.ToolEvent) {
      this.onMouseEvent(event);
    } else if (event instanceof paper.KeyEvent) {
      this.onKeyEvent(event);
    } else {
      this.onToolModeEvent(event);
    }
  }

  /**
   * Dispatcher method that invokes the onDeactivate() callback.
   */
  dispatchDeactivate() {
    this.onDeactivate();
  }

  protected onActivate() {}
  protected abstract onInterceptEvent(m: ToolMode, e?: paper.ToolEvent | paper.KeyEvent): boolean;
  protected onToolModeEvent(mode: ToolMode) {}
  protected onMouseEvent(event: paper.ToolEvent) {}
  protected onKeyEvent(event: paper.KeyEvent) {}
  protected onDeactivate() {}
}
