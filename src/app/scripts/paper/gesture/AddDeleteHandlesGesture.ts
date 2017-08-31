import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to create/delete handles for a given segment.
 */
export class AddDeleteHandlesGesture extends Gesture {
  constructor(private readonly segment: paper.Segment) {
    super();
  }

  onMouseDown(event: paper.ToolEvent) {
    if (this.segment.hasHandles()) {
      this.segment.clearHandles();
    } else {
      // TODO: polish this a bit more using the extra options argument?
      this.segment.smooth();
    }
  }
}
