import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that adds or deletes the handles associated with a path segment.
 *
 * Preconditions:
 * - The user is in focused path mode.
 * - The gesture began with a mouse down event on top of a segment.
 */
export class AddDeleteHandlesGesture extends Gesture {
  constructor(
    private readonly ps: PaperService,
    private readonly focusedPathId: string,
    private readonly hitSegmentIndex: number,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const path = new paper.Path(PaperUtil.getPathFromStore(this.ps, this.focusedPathId));
    const segment = path.segments[this.hitSegmentIndex];
    if (segment.hasHandles()) {
      segment.clearHandles();
    } else {
      // TODO: polish this a bit more using the extra options argument?
      segment.smooth();
    }
    PaperUtil.replacePathInStore(this.ps, this.focusedPathId, path.pathData);
    // TODO: should we also deselect handles after deleting them from the path segment?
  }
}
