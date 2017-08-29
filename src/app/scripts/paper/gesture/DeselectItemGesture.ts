import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to delete handles for a given segment.
 */
export class DeselectItemGesture extends Gesture {
  constructor(private readonly hitItem: paper.Item) {
    super();
  }

  onMouseDown(event: paper.ToolEvent) {
    this.hitItem.selected = false;
    console.log(Items.computeBoundingBox(Selections.getSelectedItems()));
    Guides.showSelectionBoundsPath(Items.computeBoundingBox(Selections.getSelectedItems()));
  }
}
