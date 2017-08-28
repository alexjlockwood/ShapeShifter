import { ToolMode } from 'app/model/paper';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';

/**
 * Tool that enables zooming and panning the canvas.
 */
export class ZoomPanTool extends BaseTool {
  private lastPoint: paper.Point;

  // @Override
  onActivate() {
    console.log('activate');
  }

  // @Override
  onDeactivate() {
    console.log('deactivate');
  }

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
  onMouseDownEvent(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      this.lastPoint = paper.view.projectToView(event.point);
      return;
    }
    const factor = event.modifiers.alt ? 1 / 1.25 : 1.25;
    paper.view.zoom *= factor;
    paper.view.center = event.point;
  }

  // @Override
  onMouseDragEvent(event: paper.ToolEvent) {
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
  onMouseUpEvent(event: paper.ToolEvent) {}

  // @Override
  onKeyDownEvent(event: paper.KeyEvent) {}

  // @Override
  onKeyUpEvent(event: paper.KeyEvent) {}
}
