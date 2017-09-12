import { ToolMode } from 'app/model/paper';
import { Cursor, Cursors } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * Tool that enables zooming and panning the canvas.
 *
 * TODO: prevent panning outside of project coordinate bounds
 * TODO: prevent zooming out less than 100%?
 */
export class ZoomPanTool extends Tool {
  // Keep track of the last known mouse point in view space coordinates.
  private lastViewPoint = new paper.Point(0, 0);

  constructor(private readonly paperService: PaperService) {
    super();
  }

  // @Override
  onActivate() {
    Cursors.set(Cursor.ZoomIn);
  }

  // @Override
  onDeactivate() {
    Cursors.clear();
  }

  // @Override
  onMouseEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.onMouseDrag(event);
    } else if (event.type === 'mouseup') {
      Cursors.remove(Cursor.Grabbing);
    }
  }

  private onMouseDown(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      // If space is pressed, then grab/pan the artwork. We store the last known
      // mouse point in view space coordinates (which means the top left corner
      // of the canvas will always be (0, 0), no matter how much we've panned/zoomed
      // so far).
      this.lastViewPoint = paper.view.projectToView(event.point);
      return;
    }
    // Zoom out if alt is pressed, and zoom in otherwise.
    paper.view.zoom *= event.modifiers.alt ? 1 / 1.25 : 1.25;
    paper.view.center = event.point;
  }

  private onMouseDrag(event: paper.ToolEvent) {
    if (!event.modifiers.space) {
      return;
    }
    Cursors.add(Cursor.Grabbing);

    // In order to have coordinate changes not mess up the dragging, we need to
    // convert coordinates to view space, and then back to project space after
    // the view has been scrolled.
    const projectPoint = event.point;
    const currentViewPoint = paper.view.projectToView(projectPoint);
    paper.view.translate(projectPoint.subtract(paper.view.viewToProject(this.lastViewPoint)));
    this.lastViewPoint = currentViewPoint;
  }

  // @Override
  onKeyEvent(event: paper.KeyEvent) {
    if (event.type === 'keydown') {
      this.onKeyDown(event);
    } else if (event.type === 'keyup') {
      this.onKeyUp(event);
    }
  }

  private onKeyDown({ key }: paper.KeyEvent) {
    if (key === 'alt') {
      Cursors.add(Cursor.ZoomOut);
    } else if (key === 'space') {
      Cursors.add(Cursor.Grab);
    }
  }

  private onKeyUp({ key }: paper.KeyEvent) {
    if (key === 'alt') {
      Cursors.remove(Cursor.ZoomOut);
    } else if (key === 'space') {
      Cursors.remove(Cursor.Grab);
    }
  }
}
