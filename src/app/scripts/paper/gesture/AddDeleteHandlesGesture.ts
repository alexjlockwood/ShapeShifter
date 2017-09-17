import { LayerUtil, PathLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil, PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that adds or deletes the handles associated with a path segment.
 *
 * Preconditions:
 * - The user is in focused path mode.
 * - The gesture began with a mouse down event on top of a segment index.
 */
export class AddDeleteHandlesGesture extends Gesture {
  constructor(
    private readonly ps: PaperService,
    private readonly focusedPathItemId: string,
    private readonly hitSegmentIndex: number,
  ) {
    super();
  }

  // @Override
  onMouseDown(e: paper.ToolEvent) {
    const path = new paper.Path(PaperUtil.getPathFromStore(this.ps, this.focusedPathItemId));
    const segment = path.segments[this.hitSegmentIndex];
    if (segment.hasHandles()) {
      segment.clearHandles();
    } else {
      // TODO: polish this a bit more using the extra options argument?
      segment.smooth();
    }
    PaperUtil.replacePathInStore(this.ps, this.focusedPathItemId, path.pathData);
    // TODO: should we also deselect handles after deleting them from the path segment?
  }
}
