import { MathUtil } from 'app/scripts/common';
import { Guides, Items, Selections } from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from '.';

/**
 * A gesture that performs selection operations on path segments and handles.
 */
export class DetailSelectionGesture extends Gesture {
  private hitType: paper.HitType;

  // @Override
  onMouseDown(event: paper.ToolEvent, hitResult: paper.HitResult) {}

  // @Override
  onMouseDrag(event: paper.ToolEvent) {}
}
