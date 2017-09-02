import { ToolMode } from 'app/model/paper';
import { Cursor, Cursors } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { BaseTool } from './BaseTool';

/**
 * Tool that enables zooming and panning the canvas.
 */
export class ZoomPanTool extends BaseTool {
  private lastPoint: paper.Point;

  // @Override
  protected onActivate() {
    Cursors.set(Cursor.ZoomIn);
  }

  // @Override
  protected onDeactivate() {
    Cursors.clear();
  }

  // @Override
  protected onMouseEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.onMouseDrag(event);
    } else if (event.type === 'mouseup') {
      this.onMouseUp(event);
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
    Cursors.add(Cursor.Grabbing);

    // In order to have coordinate changes not mess up the
    // dragging, we need to convert coordinates to view space,
    // and then back to project space after the view space has
    // changed.
    const point = paper.view.projectToView(event.point);
    const last = paper.view.viewToProject(this.lastPoint);
    paper.view.scrollBy(last.subtract(event.point));
    this.lastPoint = point;
  }

  private onMouseUp(event: paper.ToolEvent) {
    Cursors.remove(Cursor.Grabbing);
  }

  // @Override
  protected onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.onKeyUp(event);
    }
  }

  private onKeyDown(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      Cursors.add(Cursor.ZoomOut);
    } else if (event.key === 'space') {
      Cursors.add(Cursor.Grab);
    }
  }

  private onKeyUp(event: paper.KeyEvent) {
    if (event.key === 'alt') {
      Cursors.remove(Cursor.ZoomOut);
    } else if (event.key === 'space') {
      Cursors.remove(Cursor.Grab);
    }
  }
}
