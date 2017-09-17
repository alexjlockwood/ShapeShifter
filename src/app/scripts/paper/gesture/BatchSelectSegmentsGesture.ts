import { PaperLayer } from 'app/scripts/paper/item';
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
    const focusedPathInfo = this.ps.getFocusedPathInfo();
    // TODO: make use of these
    this.initialSelectedSegments = focusedPathInfo.selectedSegments;
    this.initialVisibleHandleIns = focusedPathInfo.visibleHandleIns;
    this.initialSelectedHandleIns = focusedPathInfo.selectedHandleIns;
    this.initialVisibleHandleOuts = focusedPathInfo.visibleHandleOuts;
    this.initialSelectedHandleOuts = focusedPathInfo.selectedHandleOuts;
    if (!event.modifiers.shift) {
      this.ps.setFocusedPathInfo({
        layerId: focusedPathInfo.layerId,
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
    const focusedPathInfo = this.ps.getFocusedPathInfo();
    const editPath = this.paperLayer.findItemByLayerId(focusedPathInfo.layerId) as paper.Path;
    const from = editPath.globalToLocal(event.downPoint);
    const to = editPath.globalToLocal(event.point);
    this.ps.setSelectionBox({ from, to });
    const selectedSegments = new Set<number>();
    const rectangle = new paper.Rectangle(from, to);
    editPath.segments.forEach((s, i) => {
      // TODO: select the entire curve instead
      const curveSelected =
        rectangle.contains(s.point) ||
        (event.modifiers.shift && focusedPathInfo.selectedSegments.has(i));
      if (curveSelected) {
        selectedSegments.add(i);
      }
    });
    this.ps.setFocusedPathInfo({ ...focusedPathInfo, selectedSegments });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    const selectionBox = this.ps.getSelectionBox();
    if (selectionBox) {
      const focusedPathInfo = this.ps.getFocusedPathInfo();
      const editPath = this.paperLayer.findItemByLayerId(focusedPathInfo.layerId) as paper.Path;
      const selectedSegments = new Set<number>();
      const from = editPath.globalToLocal(event.downPoint);
      const to = editPath.globalToLocal(event.point);
      const rectangle = new paper.Rectangle(new paper.Point(from), new paper.Point(to));
      editPath.segments.forEach((s, i) => {
        // TODO: select the entire curve instead
        const curveSelected =
          rectangle.contains(s.point) ||
          (event.modifiers.shift && focusedPathInfo.selectedSegments.has(i));
        if (curveSelected) {
          selectedSegments.add(i);
        }
      });
      this.ps.setSelectionBox(undefined);
      this.ps.setFocusedPathInfo({ ...focusedPathInfo, selectedSegments });
    }

    if (!this.isDragging) {
      const { layerId } = this.ps.getFocusedPathInfo();
      this.ps.setFocusedPathInfo(undefined);
      this.ps.setSelectedLayers(new Set([layerId]));
    }
  }
}
