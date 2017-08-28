import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';

/**
 * Tool that enables zooming and panning the canvas.
 */
export class ZoomPanTool extends BaseTool {
  private lastPoint: paper.Point;

  // @Override
  protected onInterceptEvent(toolMode: ToolMode, event?: paper.ToolEvent | paper.KeyEvent) {
    if (toolMode === ToolMode.ZoomPan) {
      // Intercept the event if the user is in zoom/pan mode.
      return true;
    }
    if (event instanceof paper.ToolEvent || event instanceof paper.KeyEvent) {
      // If this is a mouse or key event, intercept the event if space is pressed.
      return event.modifiers.space;
    }
    return false;
  }

  // @Override
  protected onMouseEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.onMouseDrag(event);
    }
  }

  private onMouseDown(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      this.lastPoint = paper.view.projectToView(event.point);
      return;
    }
    const factor = event.modifiers.alt ? 1 / 1.25 : 1.25;
    paper.view.zoom *= factor;
    paper.view.center = event.point;
  }

  private onMouseDrag(event: paper.ToolEvent) {
    // TODO: need to handle the case where the last point may be nil
    if (!event.modifiers.space) {
      return;
    }

    // In order to have coordinate changes not mess up the
    // dragging, we need to convert coordinates to view space,
    // and then back to project space after the view space has
    // changed.
    const point = paper.view.projectToView(event.point);
    const last = paper.view.viewToProject(this.lastPoint);
    paper.view.scrollBy(last.subtract(event.point));
    this.lastPoint = point;
  }
}
