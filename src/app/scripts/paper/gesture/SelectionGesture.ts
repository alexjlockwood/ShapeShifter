import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/** A gesture that performs selection, move, and clone operations. */
export class SelectionGesture extends Gesture {
  private selectedPaths: ReadonlyArray<paper.Item>;
  private initialPositions: ReadonlyArray<paper.Point>;

  constructor(private readonly shouldCloneSelectedItems: boolean) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent, hitResult: paper.HitResult) {
    console.log(hitResult);
    if (!event.modifiers.shift && !hitResult.item.selected) {
      Selections.deselectAll();
    }
    Selections.setSelection(hitResult.item, true);

    // While moving/cloning the shape, never show the selection bounds.
    if (this.shouldCloneSelectedItems) {
      Selections.cloneSelectedItems();
    }
    Guides.hideSelectionBounds();

    this.selectedPaths = Selections.getSelectedItems();
    this.initialPositions = this.selectedPaths.map(path => path.position);
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    const dragVector = event.point.subtract(event.downPoint);
    this.selectedPaths.forEach((item, i) => {
      if (event.modifiers.shift) {
        const snapPoint = new paper.Point(MathUtil.snapDeltaToAngle(dragVector, Math.PI / 4));
        item.position = this.initialPositions[i].add(snapPoint);
      } else {
        item.position = item.position.add(event.delta);
      }
    });
  }
}
