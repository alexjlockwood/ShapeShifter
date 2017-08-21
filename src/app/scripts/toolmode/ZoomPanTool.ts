import * as paper from 'paper';

import { AbstractTool, HitTestArgs, ToolState } from './AbstractTool';
import { ToolMode } from './ToolMode';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';
import { Cursor } from './ToolsUtil';

enum Mode {
  None,
  Zoom,
  ZoomRect,
  Pan,
}

/**
 * Zoom/pan tool that allows for zooming and panning the canvas.
 */
export class ZoomPanTool extends AbstractTool {
  // TODO: shouldn't be allowed to zoom out so much that the physical size exceeds the viewport
  constructor() {
    super();

    let mode = Mode.None;
    let initialMousePoint = new paper.Point(0, 0);
    const distanceThreshold = 8;
    const zoomFactor = 1.3;

    this.on({
      activate: () => ToolsUtil.setCanvasCursor(Cursor.Hand),
      deactivate: () => {},
      mousedown: (event: paper.MouseEvent) => {
        initialMousePoint = event.point.subtract(paper.view.center);
        mode = Mode.None;
        if (event.modifiers.command) {
          mode = Mode.Zoom;
        } else {
          ToolsUtil.setCanvasCursor(Cursor.HandGrab);
          mode = Mode.Pan;
        }
      },
      mousedrag: ({ point }: paper.MouseEvent) => {
        switch (mode) {
          case Mode.Zoom: {
            // If dragging mouse while in zoom mode, switch to zoom-rect instead.
            mode = Mode.ZoomRect;
            break;
          }
          case Mode.ZoomRect: {
            // While dragging the zoom rectangle, paint the selected area.
            ToolsUtil.createDragRect(paper.view.center.add(initialMousePoint), point);
            break;
          }
          case Mode.Pan: {
            // Handle panning by moving the view center.
            const pt = point.subtract(paper.view.center);
            const delta = initialMousePoint.subtract(pt);
            paper.view.scrollBy(delta);
            initialMousePoint = pt;
            break;
          }
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      mouseup: (event: paper.MouseEvent) => {
        switch (mode) {
          case Mode.Zoom: {
            const zoomCenter = event.point.subtract(paper.view.center);
            const moveFactor = zoomFactor - 1;
            if (event.modifiers.command && !event.modifiers.option) {
              paper.view.zoom *= zoomFactor;
              paper.view.center = paper.view.center.add(
                zoomCenter.multiply(moveFactor / zoomFactor),
              );
            } else if (event.modifiers.command && event.modifiers.option) {
              paper.view.zoom /= zoomFactor;
              paper.view.center = paper.view.center.subtract(zoomCenter.multiply(moveFactor));
            }
            break;
          }
          case Mode.ZoomRect: {
            const start = paper.view.center.add(initialMousePoint);
            const end = event.point;
            paper.view.center = start.add(end).multiply(0.5);
            const dx = paper.view.bounds.width / Math.abs(end.x - start.x);
            const dy = paper.view.bounds.height / Math.abs(end.y - start.y);
            paper.view.zoom = Math.min(dx, dy) * paper.view.zoom;
            break;
          }
        }
        this.hitTest(event);
        mode = Mode.None;
      },
      keydown: (event: paper.KeyEvent) => this.hitTest(event),
      keyup: (event: paper.KeyEvent) => this.hitTest(event),
    });
  }

  dispatchHitTest(type: string, { modifiers = {} }: HitTestArgs, toolMode: ToolMode) {
    // TODO: make sure the 'space' modifier does not conflict with the play/pause shortcut
    return (
      toolMode === ToolMode.ZoomPan &&
      modifiers.space &&
      super.dispatchHitTest(type, { modifiers }, toolMode)
    );
  }

  protected hitTest({ modifiers = {} }: HitTestArgs) {
    if (modifiers.command) {
      if (modifiers.command && !modifiers.option) {
        ToolsUtil.setCanvasCursor(Cursor.ZoomIn);
      } else if (modifiers.command && modifiers.option) {
        ToolsUtil.setCanvasCursor(Cursor.ZoomOut);
      }
    } else {
      ToolsUtil.setCanvasCursor(Cursor.Hand);
    }
    return true;
  }
}
