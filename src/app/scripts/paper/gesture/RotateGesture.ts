import { Guides, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/** A gesture that performs rotation operations. */
export class RotateGesture extends Gesture {
  private groupPivot: paper.Point;
  private rotatingItems: paper.Item[];
  private rotationAngles: number[];

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    this.rotatingItems = Selections.getSelectedItems();
    const selectionBounds = this.rotatingItems.map(i => i.bounds).reduce((p, c) => p.unite(c));
    this.groupPivot = selectionBounds.center;
    this.rotationAngles = this.rotatingItems.map(() => event.point.subtract(this.groupPivot).angle);

    // While transforming object, never show the bounds.
    Guides.hideSelectionBounds();
  }

  // @Override
  onMouseDrag(event: paper.ToolEvent) {
    let angle = event.point.subtract(this.groupPivot).angle;
    this.rotatingItems.forEach((item, i) => {
      if (event.modifiers.shift) {
        angle = Math.round(angle / 45) * 45;
        item.applyMatrix = false;
        item.pivot = this.groupPivot.clone();
        item.rotation = angle;
      } else {
        item.rotate(angle - this.rotationAngles[i], this.groupPivot);
      }
      this.rotationAngles[i] = angle;
    });
  }

  // @Override
  onMouseUp(event: paper.ToolEvent) {
    this.rotatingItems.forEach(item => (item.applyMatrix = true));
  }
}
