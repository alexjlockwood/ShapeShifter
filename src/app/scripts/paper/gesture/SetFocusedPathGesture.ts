import { ToolMode } from 'app/model/paper';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that exits selection mode and enters focused path mode.
 */
export class SetFocusedPathGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService, private readonly focusedPathId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setSelectedLayers(new Set());
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;
    this.ps.setToolMode(ToolMode.Vector);
    this.ps.setFocusedPathInfo({
      layerId: this.focusedPathId,
      ...PaperUtil.selectCurves(this.ps, focusedPath, new Set([focusedPath.segments.length - 1])),
    });
  }
}
