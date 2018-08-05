import { Gesture } from 'app/modules/editor/scripts/paper/gesture';
import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { PaperUtil } from 'app/modules/editor/scripts/paper/util';
import { PaperService } from 'app/modules/editor/services';
import * as paper from 'paper';

/**
 * A gesture that performs selection and drag operations on a segment handle.
 *
 * Preconditions:
 * - The user is in edit path mode.
 * - The user hit a segment handle.
 */
export class SelectDragHandleGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;
  private readonly hitHandleType: 'handleIn' | 'handleOut';

  // The handle's initial location in local coordinates.
  private localDownHandle: paper.Point;
  private localLastDragInfo: {
    readonly localDownPoint: paper.Point;
    readonly localPoint: paper.Point;
  };

  constructor(
    private readonly ps: PaperService,
    private readonly editPathId: string,
    private readonly hitSegmentIndex: number,
    hitResultType: 'handle-in' | 'handle-out',
  ) {
    super();
    this.hitHandleType = hitResultType === 'handle-in' ? 'handleIn' : 'handleOut';
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // Deselect all currently selected segments.
    const selectedSegments = new Set<number>();
    const selectedHandleIn = this.hitHandleType === 'handleIn' ? this.hitSegmentIndex : undefined;
    const selectedHandleOut = this.hitHandleType === 'handleOut' ? this.hitSegmentIndex : undefined;
    this.ps.setEditPathInfo({
      ...this.ps.getEditPathInfo(),
      selectedSegments,
      selectedHandleIn,
      selectedHandleOut,
    });
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    this.localDownHandle = editPath.segments[this.hitSegmentIndex][this.hitHandleType].clone();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const editPath = this.pl.findItemByLayerId(this.editPathId);
    this.localLastDragInfo = {
      localDownPoint: editPath.globalToLocal(event.downPoint),
      localPoint: editPath.globalToLocal(event.point),
    };
    this.processEvent(event);
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  // @Override
  onKeyUp(event: paper.KeyEvent) {
    this.processKeyEvent(event);
  }

  // TODO: react to 'escape' key presses
  private processKeyEvent(event: paper.KeyEvent) {
    if (event.key === 'shift') {
      this.processEvent(event);
    }
  }

  private processEvent(event: paper.Event) {
    if (!this.localLastDragInfo) {
      return;
    }
    // TODO: add 'straight', 'mirrored', 'disconnected', and 'asymmetric' modes (similar to Sketch)
    const { localDownPoint, localPoint } = this.localLastDragInfo;
    const localHandle = this.localDownHandle.add(localPoint.subtract(localDownPoint));
    if (event.modifiers.shift) {
      // Project the handle onto the handle's original vector.
      const theta = (-(this.localDownHandle.angle - localHandle.angle) * Math.PI) / 180;
      localHandle.set(
        this.localDownHandle.normalize().multiply(localHandle.length * Math.cos(theta)),
      );
    }
    const editPath = this.pl.findItemByLayerId(this.editPathId) as paper.Path;
    editPath.segments[this.hitSegmentIndex][this.hitHandleType] = localHandle;
    PaperUtil.replacePathInStore(this.ps, this.editPathId, editPath.pathData);
  }
}
