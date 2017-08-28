// TODO: 'space' conflicts with existing keyboard shortcuts!

import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/** A gesture that enables the user to pan and zoom the canvas. */
export class ZoomPanGesture extends Gesture {
  private lastPoint: paper.Point;

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (event.modifiers.space) {
      this.lastPoint = paper.view.projectToView(event.point);
      return;
    }
    const factor = event.modifiers.alt ? 1 / 1.25 : 1.25;
    paper.view.zoom *= factor;
    paper.view.center = event.point;
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    if (!event.modifiers.space) {
      return;
    }
    // body.addClass('zoom-grab');

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
  onMouseUp(event: paper.ToolEvent) {}

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    // if (event.key === 'alt') {
    // body.addClass('zoom-out');
    // } else if (event.key === 'space') {
    // body.addClass('zoom-move');
    // }
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    // body.removeClass('zoom-grab');
  }
}
