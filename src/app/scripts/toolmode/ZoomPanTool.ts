import * as paper from 'paper';

import { AbstractTool, HitTestArgs, SelectionBoundsHelper } from './AbstractTool';
import * as ToolsUtil from './ToolsUtil';
import { SelectionState } from './ToolsUtil';

export class ZoomPanTool extends AbstractTool {
  private mouseStartPos = new paper.Point(0, 0);
  private distanceThreshold = 8;
  private mode = 'pan';
  private zoomFactor = 1.3;

  constructor() {
    super();

    this.on({
      activate: () => ToolsUtil.setCanvasCursor('cursor-hand'),
      deactivate: () => {},
      mousedown: (event: paper.MouseEvent) => {
        this.mouseStartPos = event.point.subtract(paper.view.center);
        this.mode = '';
        if (event.modifiers.command) {
          this.mode = 'zoom';
        } else {
          ToolsUtil.setCanvasCursor('cursor-hand-grab');
          this.mode = 'pan';
        }
      },
      mouseup: (event: paper.MouseEvent) => {
        if (this.mode === 'zoom') {
          const zoomCenter = event.point.subtract(paper.view.center);
          const moveFactor = this.zoomFactor - 1.0;
          if (event.modifiers.command && !event.modifiers.option) {
            paper.view.zoom *= this.zoomFactor;
            paper.view.center = paper.view.center.add(
              zoomCenter.multiply(moveFactor / this.zoomFactor),
            );
          } else if (event.modifiers.command && event.modifiers.option) {
            paper.view.zoom /= this.zoomFactor;
            paper.view.center = paper.view.center.subtract(zoomCenter.multiply(moveFactor));
          }
        } else if (this.mode === 'zoom-rect') {
          const start = paper.view.center.add(this.mouseStartPos);
          const end = event.point;
          paper.view.center = start.add(end).multiply(0.5);
          const dx = paper.view.bounds.width / Math.abs(end.x - start.x);
          const dy = paper.view.bounds.height / Math.abs(end.y - start.y);
          paper.view.zoom = Math.min(dx, dy) * paper.view.zoom;
        }
        this.hitTest(event);
        this.mode = '';
      },
      mousedrag: ({ point }: paper.MouseEvent) => {
        if (this.mode === 'zoom') {
          // If dragging mouse while in zoom mode, switch to zoom-rect instead.
          this.mode = 'zoom-rect';
        } else if (this.mode === 'zoom-rect') {
          // While dragging the zoom rectangle, paint the selected area.
          ToolsUtil.dragRect(paper.view.center.add(this.mouseStartPos), point);
        } else if (this.mode === 'pan') {
          // Handle panning by moving the view center.
          const pt = point.subtract(paper.view.center);
          const delta = this.mouseStartPos.subtract(pt);
          paper.view.scrollBy(delta);
          this.mouseStartPos = pt;
        }
      },
      mousemove: (event: paper.MouseEvent) => this.hitTest(event),
      keydown: (event: paper.KeyEvent) => this.hitTest(event),
      keyup: (event: paper.KeyEvent) => this.hitTest(event),
    });
  }

  testHot(type: string, event: { point: paper.Point; modifiers?: any }, mode: string) {
    const spacePressed = event && (event.modifiers || {}).space;
    if (mode !== 'tool-zoompan' && !spacePressed) {
      return false;
    }
    return this.hitTest(event);
  }

  private hitTest({ modifiers = {} }: { modifiers?: any }) {
    if (modifiers.command) {
      if (modifiers.command && !modifiers.option) {
        ToolsUtil.setCanvasCursor('cursor-zoom-in');
      } else if (modifiers.command && modifiers.option) {
        ToolsUtil.setCanvasCursor('cursor-zoom-out');
      }
    } else {
      ToolsUtil.setCanvasCursor('cursor-hand');
    }
    return true;
  }
}
