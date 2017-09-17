import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that exits selection mode and enters focused path mode.
 */
export class SetFocusedPathGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly focusedPathItemId: string) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.ps.setSelectedLayers(new Set());
    this.ps.setFocusedPathInfo({
      layerId: this.focusedPathItemId,
      // TODO: auto-select the last curve in the path
      selectedSegments: new Set<number>(),
      visibleHandleIns: new Set<number>(),
      selectedHandleIns: new Set<number>(),
      visibleHandleOuts: new Set<number>(),
      selectedHandleOuts: new Set<number>(),
    });
  }
}
