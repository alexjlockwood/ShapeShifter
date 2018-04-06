import { Gesture } from 'app/scripts/paper/gesture';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { ToolMode } from '../../../../model/paper';
import { HoverItemsGesture } from './HoverItemsGesture';
import { HoverSegmentsCurvesGesture } from './HoverSegmentsCurvesGesture';

/**
 * A gesture that handles mouse move hover events.
 */
export class HoverGesture extends Gesture {
  private readonly hoverItemsGesture = new HoverItemsGesture(this.ps);
  private readonly hoverSegmentsCurvesGesture = new HoverSegmentsCurvesGesture(this.ps);

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    const gesture = this.getCurrentGesture();
    if (gesture) {
      gesture.onMouseMove(event);
    }
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    const gesture = this.getCurrentGesture();
    if (gesture) {
      gesture.onKeyDown(event);
    }
  }

  private getCurrentGesture() {
    if (this.ps.getToolMode() === ToolMode.Default) {
      const fpi = this.ps.getEditPathInfo();
      if (fpi) {
        if (fpi.layerId) {
          return this.hoverSegmentsCurvesGesture;
        }
      } else {
        return this.hoverItemsGesture;
      }
    }
    return undefined;
  }
}
