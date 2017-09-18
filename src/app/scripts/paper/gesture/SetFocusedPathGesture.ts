import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that exits selection mode and enters focused path mode.
 */
export class SetFocusedPathGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService, private readonly focusedPathItemId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setSelectedLayers(new Set());
    const focusedPath = this.paperLayer.findItemByLayerId(this.focusedPathItemId) as paper.Path;
    this.ps.setFocusedPathInfo({
      layerId: this.focusedPathItemId,
      ...PaperUtil.selectCurves(this.ps, focusedPath, new Set([focusedPath.segments.length - 1])),
    });
  }
}
