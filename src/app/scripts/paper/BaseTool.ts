import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

export abstract class BaseTool {
  shouldInterceptToolModeEvent(toolMode: ToolMode) {
    return false;
  }

  shouldInterceptMouseEvent(toolMode: ToolMode, event: paper.ToolEvent) {
    return false;
  }

  shouldInterceptKeyEvent(toolMode: ToolMode, event: paper.KeyEvent) {
    return false;
  }

  onActivate() {}

  onDeactivate() {}

  onToolModeEvent(toolMode: ToolMode) {}

  dispatchMouseEvent(mouseEvent: paper.ToolEvent) {
    switch (mouseEvent.type) {
      case 'mousedown':
        this.onMouseDownEvent(mouseEvent);
        break;
      case 'mousedrag':
        this.onMouseDragEvent(mouseEvent);
        break;
      case 'mousemove':
        this.onMouseMoveEvent(mouseEvent);
        break;
      case 'mouseup':
        this.onMouseUpEvent(mouseEvent);
        break;
    }
  }

  protected onMouseDownEvent(mouseEvent: paper.ToolEvent) {}

  protected onMouseDragEvent(mouseEvent: paper.ToolEvent) {}

  protected onMouseMoveEvent(mouseEvent: paper.ToolEvent) {}

  protected onMouseUpEvent(mouseEvent: paper.ToolEvent) {}

  dispatchKeyEvent(keyEvent: paper.KeyEvent) {
    switch (keyEvent.type) {
      case 'keydown':
        this.onKeyDownEvent(keyEvent);
        break;
      case 'keyup':
        this.onKeyUpEvent(keyEvent);
        break;
    }
  }

  protected onKeyDownEvent(keyEvent: paper.KeyEvent) {}

  protected onKeyUpEvent(keyEvent: paper.KeyEvent) {}
}
