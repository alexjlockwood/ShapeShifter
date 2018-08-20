import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as _ from 'lodash';
import * as paper from 'paper';

/**
 * A gesture that selects multiple segments using a bounded box.
 *
 * Preconditions:
 * - The user is in edit path mode.
 */
export class BatchSelectSegmentsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private initialSelectedSegments: ReadonlySet<number>;
  private updatedSelectedSegments: ReadonlySet<number>;
  private isDragging = false;

  constructor(
    private readonly ps: PaperService,
    private readonly editPathId: string,
    private readonly clearEditPathAfterDraglessClick: boolean,
  ) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.initialSelectedSegments = this.ps.getEditPathInfo().selectedSegments;
    this.updatedSelectedSegments = new Set();
    this.updateCurrentSelection(event.modifiers.command || event.modifiers.shift);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    this.ps.setSelectionBox({
      from: this.pl.globalToLocal(event.downPoint),
      to: this.pl.globalToLocal(event.point),
    });
    this.processToolEvent(event);
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    if (this.isDragging) {
      this.processToolEvent(event);
    } else if (this.clearEditPathAfterDraglessClick) {
      this.ps.setEditPathInfo(undefined);
    }
    this.ps.setSelectionBox(undefined);
  }

  private processToolEvent(event: paper.ToolEvent) {
    // Calculate the bounding rectangle to use to select segments in
    // the edit path's local coordinate space.
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    const rectangle = new paper.Rectangle(
      editPath.globalToLocal(event.downPoint),
      editPath.globalToLocal(event.point),
    );
    this.updatedSelectedSegments = new Set(
      _.flatMap(editPath.segments, ({ point }, segmentIndex) => {
        return rectangle.contains(point) ? [segmentIndex] : [];
      }),
    );
    this.updateCurrentSelection(event.modifiers.command || event.modifiers.shift);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  private processKeyEvent(event: paper.KeyEvent) {
    if (event.key === 'ctrl' || event.key === 'meta' || event.key === 'shift') {
      this.updateCurrentSelection(event.modifiers.command || event.modifiers.shift);
    }
  }

  private updateCurrentSelection(toggleInitialSelections: boolean) {
    const selectedSegments = new Set(this.updatedSelectedSegments);
    if (toggleInitialSelections) {
      this.initialSelectedSegments.forEach(segmentIndex => {
        if (selectedSegments.has(segmentIndex)) {
          selectedSegments.delete(segmentIndex);
        } else {
          selectedSegments.add(segmentIndex);
        }
      });
    }
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    this.ps.setEditPathInfo({ ...PaperUtil.selectCurves(editPath, selectedSegments) });
  }
}
