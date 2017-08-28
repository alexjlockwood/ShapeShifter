import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';

/**
 * Tool that enables zooming and panning the canvas.
 */
export class ZoomPanTool extends BaseTool {
  private lastPoint: paper.Point;

  // @Override
  shouldInterceptToolModeEvent(toolMode: ToolMode) {
    console.log('intercepting tool mode event', toolMode === ToolMode.ZoomPan);
    return toolMode === ToolMode.ZoomPan;
  }

  // @Override
  shouldInterceptMouseEvent(toolMode: ToolMode, event: paper.ToolEvent) {
    console.log('intercepting mouse event', toolMode === ToolMode.ZoomPan || event.modifiers.space);
    return toolMode === ToolMode.ZoomPan || event.modifiers.space;
  }

  // @Override
  shouldInterceptKeyEvent(toolMode: ToolMode, event: paper.KeyEvent) {
    console.log('intercepting key event', toolMode === ToolMode.ZoomPan || event.modifiers.space);
    return toolMode === ToolMode.ZoomPan || event.modifiers.space;
  }

  // @Override
  protected onMouseDownEvent(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      this.lastPoint = paper.view.projectToView(event.point);
      return;
    }
    const factor = event.modifiers.alt ? 1 / 1.25 : 1.25;
    paper.view.zoom *= factor;
    paper.view.center = event.point;
  }

  // @Override
  protected onMouseDragEvent(event: paper.ToolEvent) {
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

  // @Override
  protected onMouseUpEvent(event: paper.ToolEvent) {}

  // @Override
  protected onKeyDownEvent(event: paper.KeyEvent) {}

  // @Override
  protected onKeyUpEvent(event: paper.KeyEvent) {}
}
