import { Cursor, CursorUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Tool } from './Tool';

/**
 * A tool that enables zooming and panning in the canvas.
 */
export class ZoomPanTool extends Tool {
  // Keep track of the last known mouse point in view space coordinates.
  private viewLastPoint = new paper.Point(0, 0);

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onActivate() {
    CursorUtil.set(Cursor.ZoomIn);
  }

  // @Override
  onDeactivate() {
    CursorUtil.clear();
  }

  // @Override
  onToolEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      this.onMouseDown(event);
    } else if (event.type === 'mousedrag') {
      this.onMouseDrag(event);
    } else if (event.type === 'mouseup') {
      CursorUtil.remove(Cursor.Grabbing);
    }
  }

  private onMouseDown(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      // If space is pressed, then grab/pan the artwork. We store the last known
      // mouse point in view space coordinates (which means the top left corner
      // of the canvas will always be (0, 0), no matter how much we've panned/zoomed
      // so far).
      this.viewLastPoint = paper.view.projectToView(event.point);
      return;
    }
    // Zoom out if alt is pressed, and zoom in otherwise.
    const zoom = paper.view.zoom * (event.modifiers.alt ? 1 / 2 : 2);
    const { x, y } = paper.view.projectToView(event.point).subtract(event.point.multiply(zoom));
    this.setZoomPanInfo(zoom, x, y);
  }

  private onMouseDrag(event: paper.ToolEvent) {
    if (!event.modifiers.space) {
      return;
    }
    CursorUtil.add(Cursor.Grabbing);

    // In order to have coordinate changes not mess up the dragging, we need to
    // convert coordinates to view space, and then back to project space after
    // the view has been scrolled.
    const projPoint = event.point;
    const viewPoint = paper.view.projectToView(projPoint);
    const { tx, ty } = paper.view.matrix
      .clone()
      .translate(projPoint.subtract(paper.view.viewToProject(this.viewLastPoint)));
    this.setZoomPanInfo(paper.view.zoom, tx, ty);
    this.viewLastPoint = viewPoint;
  }

  private setZoomPanInfo(zoom: number, tx: number, ty: number) {
    const { width, height } = paper.view.viewSize;
    zoom = _.clamp(zoom, 1, 256);
    tx = _.clamp(tx, -width * (zoom - 1), 0);
    ty = _.clamp(ty, -height * (zoom - 1), 0);
    this.ps.setZoomPanInfo({ zoom, translation: { tx, ty } });
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
      CursorUtil.add(Cursor.ZoomOut);
    } else if (key === 'space') {
      CursorUtil.add(Cursor.Grab);
    }
  }

  private onKeyUp({ key }: paper.KeyEvent) {
    if (key === 'alt') {
      CursorUtil.remove(Cursor.ZoomOut);
    } else if (key === 'space') {
      CursorUtil.remove(Cursor.Grab);
    }
  }
}
