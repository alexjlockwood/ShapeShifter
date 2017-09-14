import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that can be used to create/delete handles for a given segment.
 */
export class AddDeleteHandlesGesture extends Gesture {
  constructor(private readonly ps: PaperService, private readonly segmentIndex: number) {
    super();
  }

  // @Override
  onMouseDown(event: paper.ToolEvent) {
    // if (this.segment.hasHandles()) {
    //   this.segment.clearHandles();
    // } else {
    //   // TODO: polish this a bit more using the extra options argument?
    //   this.segment.smooth();
    // }
  }
}
