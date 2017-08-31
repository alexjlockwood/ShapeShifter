import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to deselect a single item. This gesture
 * is only used during selection mode.
 */
export class DeselectItemGesture extends Gesture {
  constructor(private readonly hitItem: paper.Item) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    Selections.deselect(this.hitItem);
    Guides.showSelectionBoundsPath(Items.computeBoundingBox(Selections.getSelectedItems()));
  }
}
