import { PaperLayer } from 'app/scripts/paper/PaperLayer';
import { Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects multiple segments using a bounded box.
 * This gesture is only used during edit path mode.
 */
export class BatchSelectSegmentsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private initialSelectedSegments: ReadonlySet<number>;
  private initialVisibleHandleIns: ReadonlySet<number>;
  private initialSelectedHandleIns: ReadonlySet<number>;
  private initialVisibleHandleOuts: ReadonlySet<number>;
  private initialSelectedHandleOuts: ReadonlySet<number>;
  private isDragging = false;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    const focusedEditPath = this.ps.getFocusedEditPath();
    // TODO: make use of these
    this.initialSelectedSegments = focusedEditPath.selectedSegments;
    this.initialVisibleHandleIns = focusedEditPath.visibleHandleIns;
    this.initialSelectedHandleIns = focusedEditPath.selectedHandleIns;
    this.initialVisibleHandleOuts = focusedEditPath.visibleHandleOuts;
    this.initialSelectedHandleOuts = focusedEditPath.selectedHandleOuts;
    if (!event.modifiers.shift) {
      this.ps.setFocusedEditPath({
        layerId: focusedEditPath.layerId,
        selectedSegments: new Set<number>(),
        visibleHandleIns: new Set<number>(),
        selectedHandleIns: new Set<number>(),
        visibleHandleOuts: new Set<number>(),
        selectedHandleOuts: new Set<number>(),
      });
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    this.ps.setSelectionBox({ from: event.downPoint, to: event.point });
    const focusedEditPath = this.ps.getFocusedEditPath();
    const editPath = this.paperLayer.findItemByLayerId(focusedEditPath.layerId) as paper.Path;
    const selectedSegments = new Set<number>();
    const from = editPath.globalToLocal(event.downPoint);
    const to = editPath.globalToLocal(event.point);
    const rectangle = new paper.Rectangle(new paper.Point(from), new paper.Point(to));
    editPath.segments.forEach((s, i) => {
      // TODO: select the entire curve instead
      const curveSelected =
        rectangle.contains(s.point) ||
        (event.modifiers.shift && focusedEditPath.selectedSegments.has(i));
      if (curveSelected) {
        selectedSegments.add(i);
      }
    });
    this.ps.setFocusedEditPath({ ...focusedEditPath, selectedSegments });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const selectionBox = this.ps.getSelectionBox();
    if (selectionBox) {
      const focusedEditPath = this.ps.getFocusedEditPath();
      const editPath = this.paperLayer.findItemByLayerId(focusedEditPath.layerId) as paper.Path;
      const selectedSegments = new Set<number>();
      const from = editPath.globalToLocal(event.downPoint);
      const to = editPath.globalToLocal(event.point);
      const rectangle = new paper.Rectangle(new paper.Point(from), new paper.Point(to));
      editPath.segments.forEach((s, i) => {
        // TODO: select the entire curve instead
        const curveSelected =
          rectangle.contains(s.point) ||
          (event.modifiers.shift && focusedEditPath.selectedSegments.has(i));
        if (curveSelected) {
          selectedSegments.add(i);
        }
      });
      this.ps.setSelectionBox(undefined);
      this.ps.setFocusedEditPath({ ...focusedEditPath, selectedSegments });
    }

    if (!this.isDragging) {
      const { layerId } = this.ps.getFocusedEditPath();
      this.ps.setFocusedEditPath(undefined);
      this.ps.setSelectedLayers(new Set([layerId]));
    }
  }
}
