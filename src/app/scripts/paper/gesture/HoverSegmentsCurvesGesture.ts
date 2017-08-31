import {
  Cursor,
  Cursors,
  Guides,
  HitTests,
  Items,
  Pivots,
  Selections,
} from 'app/scripts/paper/util';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations over segments and curves.
 * This gesture is used only during 'edit path' mode.
 */
export class HoverSegmentsCurvesGesture extends Gesture {
  constructor(private readonly selectedEditPath: paper.Path) {
    super();
  }

  // @Override
  onMouseMove({ point }: paper.ToolEvent) {
    const hitResult = HitTests.editPathMode(this.selectedEditPath, point);
    if (!hitResult) {
      Cursors.clear();
      Guides.hideAddSegmentToCurveHoverGroup();
      return;
    }

    switch (hitResult.type) {
      case 'segment':
      case 'handle-in':
      case 'handle-out':
        Cursors.set(Cursor.PointSelect);
        Guides.hideAddSegmentToCurveHoverGroup();
        break;
      case 'stroke':
      case 'curve':
        Cursors.set(Cursor.PenAdd);
        Guides.showAddSegmentToCurveHoverGroup(hitResult.location);
        break;
    }
  }
}
