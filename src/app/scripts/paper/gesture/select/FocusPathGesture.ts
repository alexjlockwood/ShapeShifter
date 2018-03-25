import { Gesture } from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

/**
 * A gesture that exits selection mode and enters focused path mode.
 *
 * Preconditions:
 * - The user is in selection mode.
 */
export class FocusPathGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService, private readonly focusedPathId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const focusedPath = this.pl.findItemByLayerId(this.focusedPathId) as paper.Path;
    this.ps.setSelectedLayerIds(new Set([this.focusedPathId]));
    this.ps.setFocusedPathInfo({
      layerId: this.focusedPathId,
      ...PaperUtil.selectCurves(this.ps, focusedPath, new Set([focusedPath.segments.length - 1])),
    });
  }
}
