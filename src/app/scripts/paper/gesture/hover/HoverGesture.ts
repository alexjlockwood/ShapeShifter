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
    if (this.ps.getToolMode() === ToolMode.Default) {
      const fpi = this.ps.getEditPathInfo();
      if (fpi) {
        if (fpi.layerId) {
          this.hoverSegmentsCurvesGesture.onMouseMove(event);
        }
      } else {
        this.hoverItemsGesture.onMouseMove(event);
      }
    }
  }
}
