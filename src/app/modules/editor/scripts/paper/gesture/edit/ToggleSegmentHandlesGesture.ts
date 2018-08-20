import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that toggles the handles associated with a path segment.
 *
 * Preconditions:
 * - The user is in edit path mode.
 * - The gesture began with a mouse down event on top of a segment
 *   (typically this is the second mouse down of a double click).
 */
export class ToggleSegmentHandlesGesture extends Gesture {
  constructor(
    private readonly ps: PaperService,
    private readonly editPathId: string,
    private readonly hitSegmentIndex: number,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const path = new paper.Path(PaperUtil.getPathFromStore(this.ps, this.editPathId));
    const segment = path.segments[this.hitSegmentIndex];
    if (segment.hasHandles()) {
      segment.clearHandles();
    } else {
      // TODO: polish this a bit more using the extra options argument?
      segment.smooth();
    }
    PaperUtil.replacePathInStore(this.ps, this.editPathId, path.pathData);
  }
}
