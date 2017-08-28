import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

export abstract class BaseTool {
  dispatchActivate() {
    this.onActivate();
  }

  dispatchInterceptEvent(toolMode: ToolMode, event?: paper.ToolEvent | paper.KeyEvent) {
    return this.onInterceptEvent(toolMode, event);
  }

  dispatchEvent(event: ToolMode | paper.ToolEvent | paper.KeyEvent) {
    if (event instanceof paper.ToolEvent) {
      this.onMouseEvent(event);
    } else if (event instanceof paper.KeyEvent) {
      this.onKeyEvent(event);
    } else {
      this.onToolModeEvent(event);
    }
  }

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
