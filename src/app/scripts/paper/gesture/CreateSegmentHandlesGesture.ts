import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to delete handles for a given segment.
 */
export class CreateSegmentHandlesGesture extends Gesture {
  constructor(private readonly segment: paper.Segment) {
    super();
  }

  onMouseDown(event: paper.ToolEvent) {}
}
