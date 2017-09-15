import { LayerUtil, PathLayer } from 'app/model/layers';
import { Path } from 'app/model/paths';
import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, Cursors } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that adds or deletes the handles associated with a path segment.
 */
export class AddDeleteHandlesGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly segmentIndex: number) {
    super();
  }

  // @Override
  onMouseDown(e: paper.ToolEvent) {
    const focusedEditPath = this.ps.getFocusedEditPath();
    const vl = this.ps.getVectorLayer().clone();
    const pathLayer = vl.findLayerById(focusedEditPath.layerId).clone() as PathLayer;
    const path = new paper.Path(pathLayer.pathData.getPathString());
    const segment = path.segments[this.segmentIndex];
    if (segment.hasHandles()) {
      segment.clearHandles();
    } else {
      // TODO: polish this a bit more using the extra options argument?
      segment.smooth();
    }
    pathLayer.pathData = new Path(path.pathData);
    const newVl = LayerUtil.replaceLayer(vl, pathLayer.id, pathLayer);
    this.ps.setVectorLayer(newVl);

    // TODO: should we also deselect handles after deleting them from the path?
  }
}
