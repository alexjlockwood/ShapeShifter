import { PaperLayer } from 'app/scripts/paper/PaperLayer';
import { Guides, Items, Selections, Transforms } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that selects multiple segments using a bounded box.
 * This gesture is only used during edit path mode.
 */
export class BatchSelectSegmentsGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  private isDragging = false;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    if (!event.modifiers.shift) {
      const focusedEditPath = this.ps.getFocusedEditPath();
      this.ps.setFocusedEditPath({ ...focusedEditPath, selectedSegments: [] });
    }
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    this.isDragging = true;
    // this.ps.setSelectionBox({ from: event.downPoint, to: event.point });
    // const selectionBox = new paper.Rectangle(event.)
    // const { layerId } = this.ps.getFocusedEditPath();
    // const editPath = this.paperLayer.findItemByLayerId(layerId) as paper.Path;
    // editPath.segments.forEach(segment => {
    //   segment.curve.selected =
    //     selectionBox.contains(segment.point) || (event.modifiers.shift && segment.selected);
    // });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    // const selectionBox = this.ps.getSelectionBox();
    // if (selectionBox) {
    //   this.selectedEditPath.segments.forEach(segment => {
    //     segment.curve.selected =
    //       selectionBox.contains(segment.point) || (event.modifiers.shift && segment.selected);
    //   });
    //   this.ps.setSelectionBox(undefined);
    // }

    if (!this.isDragging) {
      const { layerId } = this.ps.getFocusedEditPath();
      this.ps.setFocusedEditPath(undefined);
      this.ps.setSelectedLayers(new Set([layerId]));
    }
  }
}
