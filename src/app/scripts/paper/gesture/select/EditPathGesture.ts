import { Gesture } from 'app/scripts/paper/gesture';
import { PaperLayer } from 'app/scripts/paper/item';
import { PaperUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

/**
 * A gesture that exits selection mode and enters edit path mode.
 *
 * Preconditions:
 * - The user is in selection mode.
 */
export class EditPathGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService, private readonly editPathId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    this.ps.setSelectedLayerIds(new Set([this.editPathId]));
    this.ps.setEditPathInfo({
      layerId: this.editPathId,
      ...PaperUtil.selectCurves(editPath, new Set([editPath.segments.length - 1])),
    });
  }
}
