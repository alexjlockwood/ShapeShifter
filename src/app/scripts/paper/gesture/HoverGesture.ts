import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/** A gesture that performs hover operations. */
export class HoverGesture extends Gesture {
  // @Override
  onMouseMove(event: paper.ToolEvent) {
    Guides.showOrHideHoverPath(event.point, {
      segments: true,
      stroke: true,
      curves: true,
      fill: true,
      tolerance: 8 / paper.view.zoom,
    });
  }
}
