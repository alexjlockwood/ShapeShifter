import { ToolMode } from 'app/model/paper';
import { Cursor, CursorUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
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

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onActivate() {
    console.log('size', paper.view.size);
    console.log('viewSize', paper.view.viewSize);
    CursorUtil.set(Cursor.ZoomIn);
  }

  // @Override
  onDeactivate() {
    CursorUtil.clear();
  }

  // @Override
  onMouseEvent(event: paper.ToolEvent) {
    if (event.type === 'mousedown') {
      console.log(paper.view.matrix.values);
      this.onMouseDown(event);
      console.log(paper.view.matrix.values);
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
      this.lastViewPoint = paper.view.projectToView(event.point);
      return;
    }
    // Zoom out if alt is pressed, and zoom in otherwise.
    // const zoom = Math.max(paper.view.zoom * (event.modifiers.alt ? 1 / 1.25 : 1.25), 1);
    const oldZoom = paper.view.zoom;
    const newZoom = oldZoom * (event.modifiers.alt ? 1 / 2 : 2);
    this.ps.setZoomPanInfo({
      zoom: newZoom,
      translation: { x: 0, y: 0 },
    });
  }

  private onMouseDrag(event: paper.ToolEvent) {
    if (!event.modifiers.space) {
      return;
    }
    CursorUtil.add(Cursor.Grabbing);

    // In order to have coordinate changes not mess up the dragging, we need to
    // convert coordinates to view space, and then back to project space after
    // the view has been scrolled.
    const projectPoint = event.point;
    const currentViewPoint = paper.view.projectToView(projectPoint);
    const currentMatrix = paper.view.matrix.clone();
    currentMatrix.append(
      new paper.Matrix().translate(
        projectPoint.subtract(paper.view.viewToProject(this.lastViewPoint)),
      ),
    );
    const zoom = paper.view.zoom;
    // const translation = {
    //   x: Math.max(0, currentMatrix.tx),
    //   y: Math.max(0, currentMatrix.ty),
    // };
    // console.log(translation);
    // console.log(paper.view.size);
    // console.log(paper.view.viewSize);
    this.ps.setZoomPanInfo({
      zoom,
      translation: { x: currentMatrix.tx, y: currentMatrix.ty },
    });
    this.lastViewPoint = currentViewPoint;
  }

  private clampTranslation(tx: number, ty: number) {
    const minTranslation = new paper.Point(paper.view.size).subtract(
      new paper.Point(paper.view.viewSize),
    );
    console.log(minTranslation.x, minTranslation.y, tx, ty);
    return {
      x: Math.max(minTranslation.x, tx),
      y: Math.max(minTranslation.y, ty),
    };
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
