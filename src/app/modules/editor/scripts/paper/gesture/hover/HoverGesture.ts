import { ToolMode } from 'app/modules/editor/model/paper';
import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

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
    if (this.ps.getToolMode() !== ToolMode.Default) {
      return undefined;
    }
    const epi = this.ps.getEditPathInfo();
    if (!epi) {
      return this.hoverItemsGesture;
    }
    if (!this.ps.getSelectedLayerIds().size) {
      // If we are in edit path mode but there is no selected layer ID, then
      // the user is using the 'vector' tool and hasn't yet started to create
      // a path. In this case we do not want to show any hovers.
      return undefined;
    }
    return this.hoverSegmentsCurvesGesture;
  }
}
