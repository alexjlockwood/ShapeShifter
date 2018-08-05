import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that exits default mode and enters edit path mode.
 *
 * Preconditions:
 * - The user is in default mode.
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
      ...PaperUtil.selectCurves(editPath, new Set([editPath.segments.length - 1])),
    });
    this.ps.setRotateItemsInfo(undefined);
    this.ps.setTransformPathsInfo(undefined);
  }
}
