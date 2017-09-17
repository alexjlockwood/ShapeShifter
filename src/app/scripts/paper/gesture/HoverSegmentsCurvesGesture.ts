import { PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as _ from 'lodash';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations over segments and curves.
 * This gesture is used only during 'edit path' mode.
 */
export class HoverSegmentsCurvesGesture extends Gesture {
  private readonly paperLayer = paper.project.activeLayer as PaperLayer;
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove({ point }: paper.ToolEvent) {
    // Cursors.clear();
    // Guides.hidePenPathPreviewPath();
    // Guides.hideAddSegmentToCurveHoverGroup();
    // const focusedPathInfo = this.ps.getFocusedPathInfo();
    // const editPath = this.paperLayer.findItemByLayerId(focusedPathInfo.layerId) as paper.Path;
    // const hitResult = HitTests.editPathMode(editPath, point);
    // if (!hitResult) {
    //   const singleSelectedSegment = this.findSingleSelectedEndSegment();
    //   if (singleSelectedSegment) {
    //     Cursors.set(Cursor.PenAdd);
    //     Guides.showPenPathPreviewPath(singleSelectedSegment, point);
    //   }
    //   return;
    // }
    // this.handleMouseMoveHit(hitResult);
  }

  // private handleMouseMoveHit(hitResult: paper.HitResult) {
  // if (hitResult.type === 'segment') {
  //   const singleSelectedSegment = this.findSingleSelectedEndSegment();
  //   if (
  //     singleSelectedSegment &&
  //     ((singleSelectedSegment.isFirst() && hitResult.segment.isLast()) ||
  //       (singleSelectedSegment.isLast() && hitResult.segment.isFirst()))
  //   ) {
  //     Cursors.set(Cursor.PenAdd);
  //     Guides.showPenPathPreviewPath(singleSelectedSegment, hitResult.segment.point);
  //     return;
  //   }
  // }
  // switch (hitResult.type) {
  //   case 'segment':
  //   case 'handle-in':
  //   case 'handle-out':
  //     // Show a point select cursor if the user is hovering over
  //     // a segment or handle.
  //     Cursors.set(Cursor.PointSelect);
  //     break;
  //   case 'stroke':
  //   case 'curve':
  //     // Show a pen add cursor if the user is hovering over a curve
  //     // on the selected edit path.
  //     Cursors.set(Cursor.PenAdd);
  //     Guides.showAddSegmentToCurveHoverGroup(hitResult.location);
  //     break;
  // }
  // }

  /**
   * Returns the single selected end point segment for the selected
   * edit path, or undefined if one doesn't exist.
   */
  private findSingleSelectedEndSegment() {
    const focusedPathInfo = this.ps.getFocusedPathInfo();
    const focusedPath = this.paperLayer.findItemByLayerId(focusedPathInfo.layerId) as paper.Path;
    if (focusedPath.closed) {
      // Return undefined if the path is closed.
      return undefined;
    }
    const { selectedSegments } = focusedPathInfo;
    if (selectedSegments.size !== 1) {
      // Return undefined if there is not a single selected segment.
      return undefined;
    }
    const lastIndex = focusedPath.segments.length - 1;
    return selectedSegments.has(0) ? 0 : selectedSegments.has(lastIndex) ? lastIndex : undefined;
  }
}
