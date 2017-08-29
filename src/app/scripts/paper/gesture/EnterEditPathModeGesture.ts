import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to enter edit path mode for a single selected path.
 */
export class EnterEditPathModeGesture extends Gesture {
  constructor(private readonly selectedEditPath: paper.Path) {
    super();
  }

  onMouseDown(event: paper.ToolEvent) {
    Selections.deselectAll();

    // Begin edit path mode by selecting the last two curves in the path.
    const startIndex = Math.max(0, this.selectedEditPath.curves.length - 2);
    const endIndex = this.selectedEditPath.curves.length;
    const lastTwoCurves = this.selectedEditPath.curves.slice(startIndex, endIndex);
    lastTwoCurves.forEach(c => (c.selected = true));
  }
}
